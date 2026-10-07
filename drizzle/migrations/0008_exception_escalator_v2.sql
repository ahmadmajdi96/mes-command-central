CREATE OR REPLACE FUNCTION public.sweep_exceptions()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created int := 0; resolved int := 0; n int;
BEGIN
  INSERT INTO order_exceptions (order_id, type, severity, title, description, source, auto_key, due_at)
  SELECT o.id, 'delayed', CASE WHEN o.due_date < current_date - 3 THEN 'high' ELSE 'medium' END,
         'Order '||o.number||' is overdue', 'Due '||o.due_date||', status '||o.status, 'escalator', 'order:'||o.id, now() + interval '24 hours'
  FROM sales_orders o
  WHERE o.due_date < current_date AND o.status NOT IN ('draft','shipped','delivered','cancelled')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; created := created + n;

  INSERT INTO order_exceptions (order_id, fulfillment_id, type, severity, title, description, source, auto_key, due_at)
  SELECT f.order_id, f.id, 'delayed', CASE WHEN f.promised_date < current_date THEN 'high' ELSE 'medium' END,
         'Fulfillment '||f.number||' is delayed', 'Status '||f.status||' since '||to_char(f.status_changed_at,'YYYY-MM-DD HH24:MI'), 'escalator', 'fulfillment:'||f.id, now() + interval '12 hours'
  FROM fulfillments f
  WHERE f.status IN ('pending','picking','packed') AND (f.status_changed_at < now() - interval '48 hours' OR f.promised_date < current_date)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; created := created + n;

  INSERT INTO order_exceptions (integration_message_id, order_id, type, severity, title, description, source, auto_key, due_at)
  SELECT m.id, CASE WHEN m.entity_table = 'sales_orders' THEN m.entity_id END, 'integration_failed',
         CASE WHEN m.status = 'dead' THEN 'high' ELSE 'medium' END,
         upper(m.system)||' '||m.message_type||' message '||m.status, left(coalesce(m.error,'No error text'), 500), 'escalator', 'message:'||m.id, now() + interval '4 hours'
  FROM integration_messages m
  WHERE m.status IN ('dead','held') OR (m.status = 'failed' AND m.direction = 'inbound')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; created := created + n;

  -- Close the loop: resolve auto exceptions whose cause is gone.
  UPDATE order_exceptions e SET status = 'resolved', resolved_at = now(), resolution = 'Resolved automatically — the problem cleared'
  WHERE e.source = 'escalator' AND e.status NOT IN ('resolved','closed') AND (
    (e.auto_key LIKE 'order:%' AND NOT EXISTS (SELECT 1 FROM sales_orders o WHERE o.id = e.order_id AND o.due_date < current_date AND o.status NOT IN ('draft','shipped','delivered','cancelled')))
    OR (e.auto_key LIKE 'fulfillment:%' AND NOT EXISTS (SELECT 1 FROM fulfillments f WHERE f.id = e.fulfillment_id AND f.status IN ('pending','picking','packed') AND (f.status_changed_at < now() - interval '48 hours' OR f.promised_date < current_date)))
    OR (e.auto_key LIKE 'message:%' AND NOT EXISTS (SELECT 1 FROM integration_messages m WHERE m.id = e.integration_message_id AND (m.status IN ('dead','held') OR (m.status = 'failed' AND m.direction = 'inbound'))))
  );
  GET DIAGNOSTICS resolved = ROW_COUNT;

  IF created > 0 THEN
    INSERT INTO notifications(entity_table, action, summary, payload)
    VALUES ('order_exceptions', 'ALERT', created||' new problem(s) added to the priority queue', jsonb_build_object('created', created));
  END IF;
  RETURN jsonb_build_object('created', created, 'auto_resolved', resolved);
END $$;
REVOKE ALL ON FUNCTION public.sweep_exceptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sweep_exceptions() TO authenticated;

-- Priority queue: severity + escalation + overdue age
CREATE OR REPLACE VIEW public.v_exception_queue WITH (security_invoker = true) AS
SELECT e.*,
  (CASE e.severity WHEN 'critical' THEN 400 WHEN 'high' THEN 300 WHEN 'medium' THEN 200 ELSE 100 END)
  + e.escalation_level * 50
  + LEAST(GREATEST(EXTRACT(epoch FROM now() - e.due_at) / 3600, 0), 100)::int AS priority_score,
  o.number AS order_number, f.number AS fulfillment_number, m.message_type AS message_type, m.system AS message_system
FROM order_exceptions e
LEFT JOIN sales_orders o ON o.id = e.order_id
LEFT JOIN fulfillments f ON f.id = e.fulfillment_id
LEFT JOIN integration_messages m ON m.id = e.integration_message_id
WHERE e.status NOT IN ('resolved','closed');
GRANT SELECT ON public.v_exception_queue TO authenticated;

-- Alert rules: new metrics + cooldown (re-alert only after 1h or when the count rises)
CREATE OR REPLACE FUNCTION public.run_alert_rules()
RETURNS integer LANGUAGE plpgsql SET search_path TO 'public' AS $function$
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

INSERT INTO alert_rules (name, metric, threshold, severity, create_exception, enabled)
SELECT * FROM (VALUES
  ('Overdue orders', 'orders_overdue', 0, 'high', false, true),
  ('Delayed fulfillments', 'fulfillments_delayed', 0, 'medium', false, true),
  ('Failed integration messages', 'messages_failed', 0, 'high', false, true)
) v(name, metric, threshold, severity, create_exception, enabled)
WHERE NOT EXISTS (SELECT 1 FROM alert_rules a WHERE a.metric = v.metric);

-- Run the sweep in the 5-minute job, before escalation
CREATE OR REPLACE FUNCTION public.run_scheduled_housekeeping()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE sw jsonb; esc int; al int; due int; r jsonb;
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
  r := jsonb_build_object('queued', sw->'created', 'auto_resolved', sw->'auto_resolved', 'escalated', esc, 'alerts_fired', al, 'outbound_due', due);
  INSERT INTO public.scheduler_runs (source, result) VALUES ('database', r);
  DELETE FROM public.scheduler_runs WHERE ran_at < now() - interval '14 days';
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.scheduler_runs (source, ok, result) VALUES ('database', false, jsonb_build_object('error', SQLERRM));
  RETURN jsonb_build_object('error', SQLERRM);
END $$;
REVOKE ALL ON FUNCTION public.run_scheduled_housekeeping() FROM PUBLIC, anon, authenticated;