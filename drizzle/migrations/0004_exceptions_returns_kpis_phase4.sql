CREATE TABLE public.order_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text,
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  fulfillment_id uuid REFERENCES public.fulfillments(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'other',
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  owner_id uuid,
  title text NOT NULL,
  description text,
  resolution text,
  due_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  escalation_level integer NOT NULL DEFAULT 0,
  escalated_at timestamptz,
  resolved_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.exception_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id uuid NOT NULL REFERENCES public.order_exceptions(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  metric text NOT NULL,
  threshold numeric NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'medium',
  create_exception boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  last_fired_at timestamptz,
  last_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.kpi_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL UNIQUE,
  target numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.returns
  ADD COLUMN IF NOT EXISTS destination_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS return_carrier text,
  ADD COLUMN IF NOT EXISTS return_tracking text,
  ADD COLUMN IF NOT EXISTS return_shipment_status text NOT NULL DEFAULT 'awaiting',
  ADD COLUMN IF NOT EXISTS received_at timestamptz;
ALTER TABLE public.return_lines
  ADD COLUMN IF NOT EXISTS received_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condition text,
  ADD COLUMN IF NOT EXISTS inspection_notes text,
  ADD COLUMN IF NOT EXISTS disposition text,
  ADD COLUMN IF NOT EXISTS dispositioned_at timestamptz;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_exceptions, public.exception_comments, public.alert_rules, public.kpi_targets TO authenticated;
GRANT ALL ON public.order_exceptions, public.exception_comments, public.alert_rules, public.kpi_targets TO service_role;
ALTER TABLE public.order_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exception_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all order_exceptions" ON public.order_exceptions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all exception_comments" ON public.exception_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all alert_rules" ON public.alert_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all kpi_targets" ON public.kpi_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_exception_number() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n int; y text := to_char(now(),'YYYY');
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT COALESCE(max(substring(number from '\d+$')::int),0)+1 INTO n FROM order_exceptions WHERE number LIKE 'EXC-'||y||'-%';
    NEW.number := 'EXC-'||y||'-'||lpad(n::text,4,'0');
  END IF;
  IF TG_OP='INSERT' AND NEW.due_at IS NULL THEN NEW.due_at := now() + interval '24 hours'; END IF;
  IF NEW.status IN ('resolved','closed') AND NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_exception_number BEFORE INSERT OR UPDATE ON public.order_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_exception_number();
CREATE TRIGGER order_exceptions_updated_at BEFORE UPDATE ON public.order_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_notify_order_exceptions AFTER INSERT OR DELETE OR UPDATE ON public.order_exceptions FOR EACH ROW EXECUTE FUNCTION public.notify_change();
CREATE TRIGGER alert_rules_updated_at BEFORE UPDATE ON public.alert_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Failed fulfillment automatically raises an exception
CREATE OR REPLACE FUNCTION public.fulfillment_failed_exception() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status='failed' AND OLD.status IS DISTINCT FROM 'failed' THEN
    INSERT INTO order_exceptions(order_id, fulfillment_id, type, severity, title, description, source)
    VALUES (NEW.order_id, NEW.id, 'fulfillment_failed', 'high', NEW.number||' failed', NEW.failure_reason, 'system');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fulfillment_failed_exception AFTER UPDATE ON public.fulfillments FOR EACH ROW EXECUTE FUNCTION public.fulfillment_failed_exception();

-- Escalate open exceptions past their due time (raises level, pushes due by 24h, notifies)
CREATE OR REPLACE FUNCTION public.escalate_exceptions() RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE e record; cnt int := 0;
BEGIN
  FOR e IN SELECT * FROM order_exceptions WHERE status IN ('open','in_progress','escalated') AND due_at < now() FOR UPDATE LOOP
    UPDATE order_exceptions SET status='escalated', escalation_level=escalation_level+1, escalated_at=now(), due_at=now()+interval '24 hours',
      severity = CASE WHEN severity='low' THEN 'medium' WHEN severity='medium' THEN 'high' ELSE 'critical' END
     WHERE id=e.id;
    INSERT INTO exception_comments(exception_id, body) VALUES (e.id, 'Escalated automatically to level '||(e.escalation_level+1)||' — past due');
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END $$;

-- Evaluate alert rules; each firing becomes a notification (and optionally an exception)
CREATE OR REPLACE FUNCTION public.run_alert_rules() RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r record; c int; fired int := 0;
BEGIN
  FOR r IN SELECT * FROM alert_rules WHERE enabled LOOP
    c := CASE r.metric
      WHEN 'orders_past_sla' THEN (SELECT count(*) FROM v_order_monitor WHERE status NOT IN ('shipped','delivered','cancelled') AND sla_hours IS NOT NULL AND hours_in_status > sla_hours)
      WHEN 'orders_on_hold' THEN (SELECT count(*) FROM sales_orders WHERE status='on_hold')
      WHEN 'fulfillments_delayed' THEN (SELECT count(*) FROM fulfillments WHERE status IN ('pending','picking','packed') AND (status_changed_at < now()-interval '48 hours' OR promised_date < current_date))
      WHEN 'fulfillments_failed' THEN (SELECT count(*) FROM fulfillments WHERE status='failed')
      WHEN 'open_exceptions' THEN (SELECT count(*) FROM order_exceptions WHERE status NOT IN ('resolved','closed'))
      WHEN 'backorder_units' THEN (SELECT COALESCE(sum(GREATEST(ordered-shipped-in_fulfillment-allocated_open,0)),0)::int FROM v_line_fulfillment v JOIN sales_orders o ON o.id=v.order_id WHERE o.status NOT IN ('draft','cancelled','delivered'))
      WHEN 'returns_pending' THEN (SELECT count(*) FROM returns WHERE status IN ('requested','approved'))
      ELSE 0 END;
    UPDATE alert_rules SET last_count=c WHERE id=r.id;
    IF c > r.threshold THEN
      INSERT INTO notifications(entity_table, entity_id, action, summary, payload)
      VALUES ('alert_rules', r.id, 'ALERT', r.name||': '||c||' (limit '||r.threshold||')', jsonb_build_object('metric',r.metric,'value',c,'severity',r.severity));
      IF r.create_exception THEN
        INSERT INTO order_exceptions(type, severity, title, description, source) VALUES ('alert', r.severity, r.name, c||' found, limit '||r.threshold, 'alert');
      END IF;
      UPDATE alert_rules SET last_fired_at=now() WHERE id=r.id;
      fired := fired + 1;
    END IF;
  END LOOP;
  RETURN fired;
END $$;

-- Return receiving + disposition (restock puts stock back at the return destination)
CREATE OR REPLACE FUNCTION public.receive_return(_return uuid, _location uuid) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF _location IS NULL THEN RAISE EXCEPTION 'Choose the receiving location'; END IF;
  UPDATE returns SET destination_location_id=_location, received_at=now(), return_shipment_status='received' WHERE id=_return;
  UPDATE return_lines SET received_qty = qty WHERE return_id=_return AND received_qty = 0;
END $$;

CREATE OR REPLACE FUNCTION public.disposition_return_line(_line uuid, _disposition text, _condition text, _notes text) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE l record; rt record;
BEGIN
  SELECT * INTO l FROM return_lines WHERE id=_line FOR UPDATE;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Return line not found'; END IF;
  IF l.disposition IS NOT NULL THEN RAISE EXCEPTION 'This line already has a decision (%)', l.disposition; END IF;
  IF _disposition NOT IN ('restock','repair','quarantine','dispose') THEN RAISE EXCEPTION 'Unknown decision %', _disposition; END IF;
  SELECT * INTO rt FROM returns WHERE id=l.return_id;
  IF rt.received_at IS NULL THEN RAISE EXCEPTION 'Receive the return before inspecting it'; END IF;
  IF _disposition='restock' AND l.product_id IS NOT NULL AND l.received_qty > 0 THEN
    PERFORM inv_move(l.product_id, rt.destination_location_id, 'receipt', l.received_qty, NULL, rt.number||' restock');
  END IF;
  UPDATE return_lines SET disposition=_disposition, condition=_condition, inspection_notes=_notes, dispositioned_at=now() WHERE id=_line;
END $$;

INSERT INTO kpi_targets(metric, target) VALUES
 ('on_time_ship_rate',95),('fill_rate',98),('avg_cycle_hours',48),('exception_rate',5),('return_rate',3),('open_backorder_units',0)
ON CONFLICT (metric) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.order_exceptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.exception_comments;