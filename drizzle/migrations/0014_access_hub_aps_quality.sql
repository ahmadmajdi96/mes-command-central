
-- ===== 1. Access Hub authority =====
CREATE TABLE public.access_hub_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enforced boolean NOT NULL DEFAULT false,
  last_status text,
  last_message text,
  last_checked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.access_hub_state TO authenticated;
GRANT ALL ON public.access_hub_state TO service_role;
ALTER TABLE public.access_hub_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hub state read" ON public.access_hub_state FOR SELECT TO authenticated USING (true);
INSERT INTO public.access_hub_state(id) VALUES (1);

ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'local';
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS hub_user_id uuid;
ALTER TABLE public.app_roles ADD COLUMN IF NOT EXISTS hub_synced_at timestamptz;

CREATE OR REPLACE FUNCTION public.app_can_any(_res text[], _act text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    CASE WHEN COALESCE((SELECT enforced FROM public.access_hub_state WHERE id=1), false) THEN
      EXISTS (
        SELECT 1 FROM public.user_app_roles uar
        JOIN public.app_roles r ON r.id = uar.role_id AND r.source = 'hub'
        JOIN public.app_role_permissions p ON p.role_id = uar.role_id
        WHERE uar.user_id = auth.uid() AND p.resource = ANY(_res)
          AND ((_act='read' AND p.can_read) OR (_act='create' AND p.can_create)
            OR (_act='update' AND p.can_update) OR (_act='delete' AND p.can_delete)))
      OR (_act = 'read' AND NOT EXISTS (
        SELECT 1 FROM public.user_app_roles uar JOIN public.app_roles r ON r.id=uar.role_id AND r.source='hub' WHERE uar.user_id = auth.uid()))
    ELSE
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.user_app_roles uar
        JOIN public.app_role_permissions p ON p.role_id = uar.role_id
        WHERE uar.user_id = auth.uid() AND p.resource = ANY(_res)
          AND ((_act='read' AND p.can_read) OR (_act='create' AND p.can_create)
            OR (_act='update' AND p.can_update) OR (_act='delete' AND p.can_delete)))
      OR (_act = 'read' AND NOT EXISTS (SELECT 1 FROM public.user_app_roles WHERE user_id = auth.uid()))
    END
  );
$$;

-- ===== 2. Shared event envelope =====
ALTER TABLE public.integration_messages
  ADD COLUMN IF NOT EXISTS correlation_id text,
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS entity_revision integer,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS schema_version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS outcome text;
CREATE UNIQUE INDEX IF NOT EXISTS integration_messages_idem_uq ON public.integration_messages(system, direction, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS integration_messages_corr_idx ON public.integration_messages(correlation_id);

CREATE OR REPLACE FUNCTION public.queue_outbound(_event text, _entity_table text, _entity_id uuid, _payload jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ep record; n int := 0; corr text; rev int; idem text;
BEGIN
  corr := COALESCE(_payload->>'correlation_id', _entity_table || ':' || _entity_id::text);
  rev := NULLIF(_payload->>'revision','')::int;
  idem := _event || ':' || _entity_id::text || ':' || md5(_payload::text);
  FOR ep IN SELECT * FROM integration_endpoints WHERE enabled AND _event = ANY(events) LOOP
    INSERT INTO integration_messages(message_id, system, direction, message_type, status, endpoint_id, entity_table, entity_id, payload, next_retry_at,
      correlation_id, source_system, entity_revision, occurred_at, idempotency_key)
    VALUES (gen_random_uuid()::text, ep.system, 'outbound', _event, 'pending', ep.id, _entity_table, _entity_id, _payload, now(),
      corr, 'mes-command-central', rev, now(), idem)
    ON CONFLICT DO NOTHING;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

INSERT INTO public.integration_endpoints(system, name, events, enabled)
SELECT 'aps', 'APS planning (Production Command Center)', ARRAY['production_order.released','production_order.changed','production_order.cancelled'], false
WHERE NOT EXISTS (SELECT 1 FROM public.integration_endpoints WHERE system='aps');

-- ===== 3. Production order planning state (APS) =====
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS planning_status text NOT NULL DEFAULT 'unplanned',
  ADD COLUMN IF NOT EXISTS aps_schedule_version text,
  ADD COLUMN IF NOT EXISTS aps_machine text,
  ADD COLUMN IF NOT EXISTS aps_sequence integer,
  ADD COLUMN IF NOT EXISTS aps_planned_start timestamptz,
  ADD COLUMN IF NOT EXISTS aps_planned_end timestamptz,
  ADD COLUMN IF NOT EXISTS aps_plan_revision integer,
  ADD COLUMN IF NOT EXISTS aps_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS aps_feasibility text;
ALTER TABLE public.production_orders ADD CONSTRAINT production_orders_planning_status_chk
  CHECK (planning_status IN ('unplanned','released','planned','dispatched','in_progress','complete','cancelled'));

CREATE OR REPLACE FUNCTION public.po_revision_and_planning() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.qty IS DISTINCT FROM OLD.qty OR NEW.planned_end IS DISTINCT FROM OLD.planned_end
     OR NEW.priority IS DISTINCT FROM OLD.priority OR NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
    NEW.revision := OLD.revision + 1;
  END IF;
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.planning_status := CASE NEW.status
      WHEN 'released' THEN CASE WHEN TG_OP='UPDATE' AND OLD.planning_status IN ('planned','dispatched') THEN OLD.planning_status ELSE 'released' END
      WHEN 'in_progress' THEN 'in_progress'
      WHEN 'completed' THEN 'complete'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE COALESCE(NEW.planning_status, 'unplanned') END;
  END IF;
  -- Quality holds block completion
  IF NEW.status = 'completed' AND (TG_OP='INSERT' OR OLD.status <> 'completed') AND EXISTS (
     SELECT 1 FROM quality_holds h WHERE h.status='active' AND (h.production_order_id = NEW.id OR h.batch_id IN (SELECT id FROM batches WHERE production_order_id = NEW.id))) THEN
    RAISE EXCEPTION 'Production order % has an active quality hold — release it before completing', NEW.number;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.outbox_production_orders() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sku text; due date; ev text; p jsonb;
BEGIN
  SELECT pr.sku INTO sku FROM products pr WHERE pr.id = NEW.product_id;
  SELECT so.due_date INTO due FROM sales_orders so WHERE so.id = NEW.sales_order_id;
  IF NEW.status = 'cancelled' AND (TG_OP='INSERT' OR OLD.status <> 'cancelled') THEN ev := 'production_order.cancelled';
  ELSIF NEW.status = 'released' AND (TG_OP='INSERT' OR OLD.status <> 'released') THEN ev := 'production_order.released';
  ELSIF TG_OP='UPDATE' AND NEW.revision <> OLD.revision AND NEW.status IN ('released','in_progress') THEN ev := 'production_order.changed';
  ELSE RETURN NEW; END IF;
  p := jsonb_build_object(
    'po_number', NEW.number, 'sku', sku, 'quantity', NEW.qty,
    'due_date', to_char(COALESCE(NEW.planned_end, due, (now() + interval '14 days')::date)::timestamp, 'YYYY-MM-DD"T"00:00:00"Z"'),
    'priority', LEAST(9, GREATEST(1, COALESCE(NEW.priority, 3))),
    'status', CASE NEW.status WHEN 'cancelled' THEN 'cancelled' WHEN 'in_progress' THEN 'in_progress' ELSE 'released' END,
    'revision', NEW.revision, 'correlation_id', 'production_orders:' || NEW.id::text);
  PERFORM queue_outbound(ev, 'production_orders', NEW.id, p);
  RETURN NEW;
END $$;

-- ===== 4. Quality: holds, NCR, CAPA =====
CREATE TABLE public.quality_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text,
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  lot_code text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','released')),
  source text NOT NULL DEFAULT 'manual',
  previous_batch_status text,
  release_reason text,
  released_at timestamptz,
  released_by uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ncr_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text,
  title text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','batch','return','qc')),
  severity text NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','dispositioned','closed')),
  disposition text CHECK (disposition IN ('use_as_is','rework','scrap','return_to_supplier')),
  batch_id uuid REFERENCES public.batches(id) ON DELETE SET NULL,
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  return_id uuid REFERENCES public.returns(id) ON DELETE SET NULL,
  hold_id uuid REFERENCES public.quality_holds(id) ON DELETE SET NULL,
  qty_affected numeric CHECK (qty_affected IS NULL OR qty_affected >= 0),
  owner text,
  external_id text,
  closed_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ncr_reports_external_uq ON public.ncr_reports(external_id) WHERE external_id IS NOT NULL;
CREATE TABLE public.capas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text,
  title text NOT NULL,
  problem text,
  root_cause text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','verification','closed')),
  owner text,
  due_date date,
  effectiveness_check text,
  effectiveness_verified boolean NOT NULL DEFAULT false,
  verified_by text,
  closed_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.capa_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capa_id uuid NOT NULL REFERENCES public.capas(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'corrective' CHECK (kind IN ('corrective','preventive')),
  description text NOT NULL,
  owner text,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.capa_ncr_links (
  capa_id uuid NOT NULL REFERENCES public.capas(id) ON DELETE CASCADE,
  ncr_id uuid NOT NULL REFERENCES public.ncr_reports(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (capa_id, ncr_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_holds, public.ncr_reports, public.capas, public.capa_actions, public.capa_ncr_links TO authenticated;
GRANT ALL ON public.quality_holds, public.ncr_reports, public.capas, public.capa_actions, public.capa_ncr_links TO service_role;
ALTER TABLE public.quality_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncr_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capa_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capa_ncr_links ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE m jsonb := '{"quality_holds":["quality_holds","batches","production_orders"],"ncr_reports":["ncr","quality_holds"],"capas":["capa"],"capa_actions":["capa"],"capa_ncr_links":["capa","ncr"]}';
  t text; r text;
BEGIN
  FOR t IN SELECT jsonb_object_keys(m) LOOP
    SELECT 'ARRAY[' || string_agg(quote_literal(x), ',') || ']::text[]' INTO r FROM jsonb_array_elements_text(m->t) x;
    EXECUTE format('CREATE POLICY "perm read" ON public.%I FOR SELECT TO authenticated USING (public.app_can_any(%s, ''read''))', t, r);
    EXECUTE format('CREATE POLICY "perm insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.app_can_any(%s, ''create'') OR public.app_can_any(%s, ''update''))', t, r, r);
    EXECUTE format('CREATE POLICY "perm update" ON public.%I FOR UPDATE TO authenticated USING (public.app_can_any(%s, ''update'')) WITH CHECK (public.app_can_any(%s, ''update''))', t, r, r);
    EXECUTE format('CREATE POLICY "perm delete" ON public.%I FOR DELETE TO authenticated USING (public.app_can_any(%s, ''delete''))', t, r);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.set_quality_number() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n int; y text := to_char(now(),'YYYY'); pfx text;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    pfx := CASE TG_TABLE_NAME WHEN 'quality_holds' THEN 'QH' WHEN 'ncr_reports' THEN 'NCR' ELSE 'CAPA' END;
    EXECUTE format('SELECT COALESCE(max(substring(number from ''\d+$'')::int),0)+1 FROM public.%I WHERE number LIKE $1', TG_TABLE_NAME)
      INTO n USING pfx||'-'||y||'-%';
    NEW.number := pfx||'-'||y||'-'||lpad(n::text,4,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_qh_number BEFORE INSERT ON public.quality_holds FOR EACH ROW EXECUTE FUNCTION public.set_quality_number();
CREATE TRIGGER trg_ncr_number BEFORE INSERT ON public.ncr_reports FOR EACH ROW EXECUTE FUNCTION public.set_quality_number();
CREATE TRIGGER trg_capa_number BEFORE INSERT ON public.capas FOR EACH ROW EXECUTE FUNCTION public.set_quality_number();

CREATE OR REPLACE FUNCTION public.quality_hold_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b record;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.batch_id IS NOT NULL THEN
      SELECT * INTO b FROM batches WHERE id = NEW.batch_id;
      NEW.previous_batch_status := b.status::text;
      NEW.production_order_id := COALESCE(NEW.production_order_id, b.production_order_id);
      NEW.product_id := COALESCE(NEW.product_id, b.product_id);
      NEW.lot_code := COALESCE(NEW.lot_code, b.lot_code);
      UPDATE batches SET status = 'on_hold' WHERE id = NEW.batch_id;
    END IF;
  ELSIF NEW.status = 'released' AND OLD.status = 'active' THEN
    IF COALESCE(btrim(NEW.release_reason),'') = '' THEN RAISE EXCEPTION 'A release reason is required'; END IF;
    NEW.released_at := now(); NEW.released_by := COALESCE(NEW.released_by, auth.uid());
    IF NEW.batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM quality_holds WHERE batch_id = NEW.batch_id AND status='active' AND id <> NEW.id) THEN
      UPDATE batches SET status = COALESCE(NULLIF(NEW.previous_batch_status,'on_hold'),'in_progress')::batch_status WHERE id = NEW.batch_id AND status='on_hold';
    END IF;
  ELSIF NEW.status = 'active' AND OLD.status = 'released' THEN
    RAISE EXCEPTION 'A released hold cannot be reopened — create a new hold';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_quality_hold_rules BEFORE INSERT OR UPDATE ON public.quality_holds FOR EACH ROW EXECUTE FUNCTION public.quality_hold_rules();

CREATE OR REPLACE FUNCTION public.ncr_rules() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status = 'closed' THEN
    IF NEW.disposition IS NULL THEN RAISE EXCEPTION 'Choose a disposition before closing the nonconformance'; END IF;
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  ELSE NEW.closed_at := NULL; END IF;
  IF NEW.status = 'open' AND NEW.disposition IS NOT NULL THEN NEW.status := 'dispositioned'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ncr_rules BEFORE INSERT OR UPDATE ON public.ncr_reports FOR EACH ROW EXECUTE FUNCTION public.ncr_rules();

CREATE OR REPLACE FUNCTION public.capa_rules() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status = 'closed' AND (TG_OP='INSERT' OR OLD.status <> 'closed') THEN
    IF COALESCE(btrim(NEW.root_cause),'') = '' THEN RAISE EXCEPTION 'Record the root cause before closing the CAPA'; END IF;
    IF NOT NEW.effectiveness_verified OR COALESCE(btrim(NEW.effectiveness_check),'') = '' THEN RAISE EXCEPTION 'Verify effectiveness before closing the CAPA'; END IF;
    IF TG_OP='INSERT' OR NOT EXISTS (SELECT 1 FROM capa_actions WHERE capa_id = NEW.id) THEN RAISE EXCEPTION 'Add at least one action before closing the CAPA'; END IF;
    IF EXISTS (SELECT 1 FROM capa_actions WHERE capa_id = NEW.id AND NOT done) THEN RAISE EXCEPTION 'Every action must be done before closing the CAPA'; END IF;
    NEW.closed_at := now();
  ELSIF NEW.status <> 'closed' THEN NEW.closed_at := NULL; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_capa_rules BEFORE INSERT OR UPDATE ON public.capas FOR EACH ROW EXECUTE FUNCTION public.capa_rules();

CREATE OR REPLACE FUNCTION public.capa_action_done() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.done_at := CASE WHEN NEW.done THEN COALESCE(NEW.done_at, now()) ELSE NULL END;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_capa_action_done BEFORE INSERT OR UPDATE ON public.capa_actions FOR EACH ROW EXECUTE FUNCTION public.capa_action_done();

CREATE TRIGGER quality_holds_updated_at BEFORE UPDATE ON public.quality_holds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ncr_reports_updated_at BEFORE UPDATE ON public.ncr_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER capas_updated_at BEFORE UPDATE ON public.capas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER capa_actions_updated_at BEFORE UPDATE ON public.capa_actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_notify_quality_holds AFTER INSERT OR UPDATE OR DELETE ON public.quality_holds FOR EACH ROW EXECUTE FUNCTION public.notify_change();
CREATE TRIGGER trg_notify_ncr_reports AFTER INSERT OR UPDATE OR DELETE ON public.ncr_reports FOR EACH ROW EXECUTE FUNCTION public.notify_change();
CREATE TRIGGER trg_notify_capas AFTER INSERT OR UPDATE OR DELETE ON public.capas FOR EACH ROW EXECUTE FUNCTION public.notify_change();

-- production order triggers (after quality_holds exists)
CREATE TRIGGER trg_po_revision_planning BEFORE INSERT OR UPDATE ON public.production_orders FOR EACH ROW EXECUTE FUNCTION public.po_revision_and_planning();
CREATE TRIGGER trg_outbox_production_orders AFTER INSERT OR UPDATE ON public.production_orders FOR EACH ROW EXECUTE FUNCTION public.outbox_production_orders();
UPDATE public.production_orders SET planning_status = CASE status::text WHEN 'released' THEN 'released' WHEN 'in_progress' THEN 'in_progress' WHEN 'completed' THEN 'complete' WHEN 'cancelled' THEN 'cancelled' ELSE 'unplanned' END;

CREATE OR REPLACE FUNCTION public.notification_resource(_t text) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _t IN ('sales_orders','sales_order_lines','returns','return_lines','refunds','order_milestones','sourcing_decisions') THEN ARRAY['orders']
    WHEN _t = 'customers' THEN ARRAY['customers']
    WHEN _t = 'products' THEN ARRAY['products']
    WHEN _t IN ('shipments') THEN ARRAY['shipments']
    WHEN _t IN ('fulfillments','fulfillment_lines') THEN ARRAY['fulfillments']
    WHEN _t IN ('order_exceptions','exception_comments') THEN ARRAY['exceptions']
    WHEN _t IN ('production_orders') THEN ARRAY['production_orders']
    WHEN _t IN ('batches') THEN ARRAY['batches']
    WHEN _t IN ('product_requests','request_events') THEN ARRAY['requests']
    WHEN _t = 'quality_holds' THEN ARRAY['quality_holds']
    WHEN _t = 'ncr_reports' THEN ARRAY['ncr']
    WHEN _t IN ('capas','capa_actions') THEN ARRAY['capa']
    WHEN _t LIKE 'inventory%' OR _t IN ('reservations','allocations','supply') THEN ARRAY['inventory']
    WHEN _t LIKE 'integration%' THEN ARRAY['integrations']
    ELSE ARRAY['alerts','orders']
  END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.quality_holds, public.ncr_reports, public.capas, public.capa_actions;
