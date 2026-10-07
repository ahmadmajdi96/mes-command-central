ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric, ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS label_path text, ADD COLUMN IF NOT EXISTS label_name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reorder_point numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.exception_assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exception_assignment_rules TO authenticated;
GRANT ALL ON public.exception_assignment_rules TO service_role;
ALTER TABLE public.exception_assignment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all" ON public.exception_assignment_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ear_updated BEFORE UPDATE ON public.exception_assignment_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.auto_assign_exception() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    SELECT owner_id INTO NEW.owner_id FROM public.exception_assignment_rules WHERE type = NEW.type AND enabled LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_exc_auto_assign ON public.order_exceptions;
CREATE TRIGGER trg_exc_auto_assign BEFORE INSERT ON public.order_exceptions FOR EACH ROW EXECUTE FUNCTION public.auto_assign_exception();

CREATE OR REPLACE FUNCTION public.preview_rule(_conditions jsonb) RETURNS TABLE(order_id uuid, number text, channel text, total numeric, status text)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT o.id, o.number, o.channel, o.total, o.status FROM public.sales_orders o
  WHERE o.status NOT IN ('shipped','delivered','cancelled')
    AND (public.rule_matches(_conditions, o, NULL) OR EXISTS (SELECT 1 FROM public.sales_order_lines l WHERE l.order_id = o.id AND public.rule_matches(_conditions, o, l.product_id)))
  ORDER BY o.created_at DESC LIMIT 200
$$;
GRANT EXECUTE ON FUNCTION public.preview_rule(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.run_alert_rules()
 RETURNS integer LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE r record; c int; fired int := 0;
BEGIN
  FOR r IN SELECT * FROM alert_rules WHERE enabled LOOP
    c := CASE r.metric
      WHEN 'orders_past_sla' THEN (SELECT count(*) FROM v_order_monitor WHERE status NOT IN ('shipped','delivered','cancelled') AND sla_hours IS NOT NULL AND hours_in_status > sla_hours)
      WHEN 'orders_overdue' THEN (SELECT count(*) FROM sales_orders WHERE due_date < current_date AND status NOT IN ('draft','shipped','delivered','cancelled'))
      WHEN 'orders_on_hold' THEN (SELECT count(*) FROM sales_orders WHERE status='on_hold')
      WHEN 'fulfillments_delayed' THEN (SELECT count(*) FROM fulfillments WHERE status IN ('pending','picking','packed') AND (status_changed_at < now()-interval '48 hours' OR promised_date < current_date))
      WHEN 'fulfillments_failed' THEN (SELECT count(*) FROM fulfillments WHERE status='failed')
      WHEN 'messages_failed' THEN (SELECT count(*) FROM integration_messages WHERE status IN ('failed','dead','held'))
      WHEN 'open_exceptions' THEN (SELECT count(*) FROM order_exceptions WHERE status NOT IN ('resolved','closed'))
      WHEN 'backorder_units' THEN (SELECT COALESCE(sum(GREATEST(ordered-shipped-in_fulfillment-allocated_open,0)),0)::int FROM v_line_fulfillment v JOIN sales_orders o ON o.id=v.order_id WHERE o.status NOT IN ('draft','cancelled','delivered'))
      WHEN 'returns_pending' THEN (SELECT count(*) FROM returns WHERE status IN ('requested','approved'))
      WHEN 'low_stock' THEN (SELECT count(*) FROM products p WHERE p.reorder_point > 0 AND COALESCE((SELECT sum(on_hand - reserved) FROM inventory_levels il WHERE il.product_id = p.id),0) <= p.reorder_point)
      ELSE 0 END;
    IF c > r.threshold AND (r.last_fired_at IS NULL OR r.last_fired_at < now() - interval '1 hour' OR c > COALESCE(r.last_count, 0)) THEN
      INSERT INTO notifications(entity_table, entity_id, action, summary, payload)
      VALUES ('alert_rules', r.id, 'ALERT', r.name||': '||c||' (limit '||r.threshold||')', jsonb_build_object('metric',r.metric,'value',c,'severity',r.severity));
      IF r.create_exception AND NOT EXISTS (SELECT 1 FROM order_exceptions WHERE auto_key = 'alert:'||r.id AND status NOT IN ('resolved','closed')) THEN
        INSERT INTO order_exceptions(type, severity, title, description, source, auto_key) VALUES ('alert', r.severity, r.name, c||' found, limit '||r.threshold, 'alert', 'alert:'||r.id);
      END IF;
      UPDATE alert_rules SET last_fired_at=now() WHERE id=r.id;
      fired := fired + 1;
    END IF;
    UPDATE alert_rules SET last_count=c WHERE id=r.id;
  END LOOP;
  RETURN fired;
END $function$;

CREATE OR REPLACE FUNCTION public.run_scheduled_housekeeping()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE sw jsonb; esc int; al int; due int; r jsonb; cleaned int;
BEGIN
  sw := public.sweep_exceptions();
  esc := COALESCE(public.escalate_exceptions(), 0);
  al := COALESCE(public.run_alert_rules(), 0);
  PERFORM public.expire_reservations();
  SELECT count(*) INTO due FROM public.integration_messages
   WHERE direction = 'outbound' AND status IN ('pending','failed') AND (next_retry_at IS NULL OR next_retry_at <= now());
  IF due > 0 THEN
    PERFORM net.http_post(
      url := 'https://project--3bf5c787-2b7e-48a2-bdbd-e6fea460e0fc.lovable.app/api/public/integrations/scheduled',
      headers := jsonb_build_object('content-type','application/json','x-cron-token',(SELECT token FROM public.scheduler_token WHERE id = 1)),
      body := '{"source":"cron"}'::jsonb);
  END IF;
  DELETE FROM public.notifications WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS cleaned = ROW_COUNT;
  r := jsonb_build_object('queued', sw->'created', 'auto_resolved', sw->'auto_resolved', 'escalated', esc, 'alerts_fired', al, 'outbound_due', due, 'notifications_cleaned', cleaned);
  INSERT INTO public.scheduler_runs (source, result) VALUES ('database', r);
  DELETE FROM public.scheduler_runs WHERE ran_at < now() - interval '14 days';
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.scheduler_runs (source, ok, result) VALUES ('database', false, jsonb_build_object('error', SQLERRM));
  RETURN jsonb_build_object('error', SQLERRM);
END $function$;