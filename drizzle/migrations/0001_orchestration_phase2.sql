ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'direct';
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'standard';
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS route text;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS hold_reason text;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS status_changed_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE public.workflow_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL DEFAULT 'sales_order',
  from_status text NOT NULL,
  to_status text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sla_hours integer,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity, from_status, to_status)
);
CREATE TABLE public.order_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  milestone text NOT NULL,
  from_status text,
  to_status text,
  source text NOT NULL DEFAULT 'OMS',
  actor_id uuid,
  notes text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.order_milestones(order_id, at);
CREATE TABLE public.business_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule_type text NOT NULL DEFAULT 'sourcing',
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  effective_from date,
  effective_to date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.business_rule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid,
  change text NOT NULL,
  snapshot jsonb,
  actor_id uuid,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.sourcing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  order_line_id uuid NOT NULL REFERENCES public.sales_order_lines(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES public.business_rules(id) ON DELETE SET NULL,
  rank integer NOT NULL DEFAULT 1,
  qty numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'selected',
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['workflow_transitions','order_milestones','business_rules','business_rule_history','sourcing_decisions'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "auth all %s" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END LOOP;
END $$;

INSERT INTO public.workflow_transitions(from_status, to_status, sla_hours) VALUES
 ('draft','confirmed',24),('draft','cancelled',NULL),
 ('confirmed','draft',NULL),('confirmed','on_hold',NULL),('confirmed','sourced',24),('confirmed','in_production',48),
 ('confirmed','partially_shipped',NULL),('confirmed','shipped',72),('confirmed','cancelled',NULL),
 ('on_hold','confirmed',24),('on_hold','cancelled',NULL),
 ('sourced','in_production',48),('sourced','partially_shipped',NULL),('sourced','shipped',48),('sourced','on_hold',NULL),('sourced','cancelled',NULL),('sourced','confirmed',NULL),
 ('in_production','partially_shipped',NULL),('in_production','shipped',120),('in_production','on_hold',NULL),('in_production','cancelled',NULL),
 ('partially_shipped','shipped',72),('partially_shipped','on_hold',NULL),
 ('shipped','delivered',120)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.enforce_order_transition() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (SELECT 1 FROM workflow_transitions WHERE entity='sales_order' AND from_status=OLD.status AND to_status=NEW.status AND enabled) THEN
      RAISE EXCEPTION 'Status change from "%" to "%" is not allowed by the order workflow', OLD.status, NEW.status;
    END IF;
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_enforce_order_transition BEFORE UPDATE OF status ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_transition();

CREATE OR REPLACE FUNCTION public.log_order_milestone() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO order_milestones(order_id, milestone, to_status, actor_id) VALUES (NEW.id, 'created', NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_milestones(order_id, milestone, from_status, to_status, actor_id, notes)
    VALUES (NEW.id, NEW.status, OLD.status, NEW.status, auth.uid(), CASE WHEN NEW.status='on_hold' THEN NEW.hold_reason END);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_order_milestone AFTER INSERT OR UPDATE OF status ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_milestone();

INSERT INTO public.order_milestones(order_id, milestone, to_status, at)
SELECT id, 'created', status, created_at FROM public.sales_orders;

CREATE OR REPLACE FUNCTION public.log_rule_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO business_rule_history(rule_id, change, snapshot, actor_id)
  VALUES (COALESCE(NEW.id, OLD.id), lower(TG_OP), to_jsonb(COALESCE(NEW, OLD)), auth.uid());
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_rule_history AFTER INSERT OR UPDATE OR DELETE ON public.business_rules
FOR EACH ROW EXECUTE FUNCTION public.log_rule_history();

-- Rule match helper: conditions keys (all optional): channel, order_type, customer_id, product_id, min_total, max_total
CREATE OR REPLACE FUNCTION public.rule_matches(_c jsonb, _o public.sales_orders, _product uuid) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT (NOT _c ? 'channel' OR _c->>'channel' = '' OR _c->>'channel' = _o.channel)
     AND (NOT _c ? 'order_type' OR _c->>'order_type' = '' OR _c->>'order_type' = _o.order_type)
     AND (NOT _c ? 'customer_id' OR _c->>'customer_id' = '' OR _c->>'customer_id' = _o.customer_id::text)
     AND (NOT _c ? 'product_id' OR _c->>'product_id' = '' OR _product IS NULL OR _c->>'product_id' = _product::text)
     AND (NOT _c ? 'min_total' OR _c->>'min_total' = '' OR _o.total >= (_c->>'min_total')::numeric)
     AND (NOT _c ? 'max_total' OR _c->>'max_total' = '' OR _o.total <= (_c->>'max_total')::numeric)
$$;

-- Orchestrate an order: validate, apply hold/route rules, source each line across locations (rule preference, then priority, fallbacks, multi-location split).
CREATE OR REPLACE FUNCTION public.orchestrate_order(_order uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE o public.sales_orders; l record; loc record; rule record; remaining numeric; take numeric;
        avail numeric; rnk integer; short_lines integer := 0; sourced_qty numeric := 0; preferred uuid[]; fallback_used boolean;
BEGIN
  SELECT * INTO o FROM sales_orders WHERE id=_order FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status NOT IN ('confirmed','on_hold','sourced') THEN RAISE EXCEPTION 'Only confirmed orders can be orchestrated (current: %)', o.status; END IF;
  IF o.customer_id IS NULL THEN RAISE EXCEPTION 'Validation failed: order has no customer'; END IF;
  IF NOT EXISTS (SELECT 1 FROM sales_order_lines WHERE order_id=_order) THEN RAISE EXCEPTION 'Validation failed: order has no lines'; END IF;

  -- hold rules
  FOR rule IN SELECT * FROM business_rules WHERE active AND rule_type='hold'
      AND (effective_from IS NULL OR effective_from <= current_date) AND (effective_to IS NULL OR effective_to >= current_date)
      ORDER BY priority LOOP
    IF rule_matches(rule.conditions, o, NULL) THEN
      UPDATE sales_orders SET hold_reason = COALESCE(rule.action->>'reason', rule.name), status = CASE WHEN status='on_hold' THEN status ELSE 'on_hold' END WHERE id=_order;
      INSERT INTO order_milestones(order_id, milestone, notes, actor_id) VALUES (_order, 'held_by_rule', rule.name, auth.uid());
      RETURN jsonb_build_object('result','on_hold','rule',rule.name);
    END IF;
  END LOOP;

  -- routing rule
  SELECT * INTO rule FROM business_rules WHERE active AND rule_type='routing'
     AND (effective_from IS NULL OR effective_from <= current_date) AND (effective_to IS NULL OR effective_to >= current_date)
     AND rule_matches(conditions, o, NULL) ORDER BY priority LIMIT 1;
  IF rule.id IS NOT NULL THEN UPDATE sales_orders SET route = COALESCE(rule.action->>'route', rule.name) WHERE id=_order; END IF;

  UPDATE sourcing_decisions SET status='superseded' WHERE order_id=_order AND status IN ('selected','failed');

  FOR l IN SELECT sol.id, sol.product_id, sol.qty,
              sol.qty - COALESCE((SELECT sum(qty) FROM allocations a WHERE a.order_line_id=sol.id AND a.status='allocated'),0) AS open_qty
           FROM sales_order_lines sol WHERE sol.order_id=_order AND sol.product_id IS NOT NULL LOOP
    remaining := l.open_qty;
    IF remaining <= 0 THEN CONTINUE; END IF;
    SELECT array_agg((r.action->>'location_id')::uuid ORDER BY r.priority) INTO preferred
      FROM business_rules r WHERE r.active AND r.rule_type='sourcing' AND r.action ? 'location_id'
       AND (r.effective_from IS NULL OR r.effective_from <= current_date) AND (r.effective_to IS NULL OR r.effective_to >= current_date)
       AND rule_matches(r.conditions, o, l.product_id);
    rnk := 0; fallback_used := false;
    FOR loc IN SELECT lc.id, lc.code,
                 COALESCE(array_position(preferred, lc.id), 1000) AS pref,
                 COALESCE(il.available,0) AS available
               FROM locations lc LEFT JOIN inventory_levels il ON il.location_id=lc.id AND il.product_id=l.product_id AND il.status='available'
               WHERE lc.active ORDER BY pref, lc.priority, COALESCE(il.available,0) DESC LOOP
      rnk := rnk + 1;
      EXIT WHEN remaining <= 0;
      avail := loc.available;
      IF avail <= 0 THEN
        INSERT INTO sourcing_decisions(order_id, order_line_id, location_id, rank, qty, status, failure_reason)
        VALUES (_order, l.id, loc.id, rnk, 0, 'skipped', 'No available stock');
        fallback_used := true;
        CONTINUE;
      END IF;
      take := LEAST(avail, remaining);
      PERFORM allocate_line(l.id, loc.id, take);
      INSERT INTO sourcing_decisions(order_id, order_line_id, location_id, rank, qty, status, failure_reason)
      VALUES (_order, l.id, loc.id, rnk, take, 'selected', CASE WHEN fallback_used THEN 'Alternative source (preferred unavailable)' END);
      remaining := remaining - take; sourced_qty := sourced_qty + take;
    END LOOP;
    IF remaining > 0 THEN
      short_lines := short_lines + 1;
      INSERT INTO sourcing_decisions(order_id, order_line_id, rank, qty, status, failure_reason)
      VALUES (_order, l.id, rnk + 1, remaining, 'failed', 'Insufficient stock across all locations — backorder or produce');
    END IF;
  END LOOP;

  IF short_lines = 0 AND o.status <> 'sourced' THEN
    UPDATE sales_orders SET status='sourced' WHERE id=_order;
  ELSE
    INSERT INTO order_milestones(order_id, milestone, notes, actor_id)
    VALUES (_order, 'sourcing_partial', short_lines || ' line(s) short', auth.uid());
  END IF;
  RETURN jsonb_build_object('result', CASE WHEN short_lines=0 THEN 'sourced' ELSE 'partial' END, 'short_lines', short_lines, 'allocated', sourced_qty);
END $$;

CREATE OR REPLACE VIEW public.v_order_monitor WITH (security_invoker = true) AS
SELECT o.id, o.number, o.status, o.channel, o.route, o.hold_reason, o.customer_id, o.due_date, o.total, o.status_changed_at, o.created_at,
  EXTRACT(EPOCH FROM (now() - o.status_changed_at))/3600 AS hours_in_status,
  (SELECT min(t.sla_hours) FROM workflow_transitions t WHERE t.from_status=o.status AND t.enabled AND t.sla_hours IS NOT NULL) AS sla_hours,
  (SELECT count(*) FROM sourcing_decisions d WHERE d.order_id=o.id AND d.status='failed') AS failed_steps,
  COALESCE((SELECT sum(l.qty) FROM sales_order_lines l WHERE l.order_id=o.id),0)
   - COALESCE((SELECT sum(a.qty) FROM allocations a WHERE a.order_id=o.id AND a.status='allocated'),0) AS unallocated_qty,
  (SELECT m.milestone FROM order_milestones m WHERE m.order_id=o.id ORDER BY m.at DESC LIMIT 1) AS last_milestone
FROM sales_orders o;
GRANT SELECT ON public.v_order_monitor TO authenticated;