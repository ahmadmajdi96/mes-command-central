CREATE TABLE public.kpi_drift_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL,
  value numeric,
  target numeric NOT NULL,
  direction text NOT NULL,
  emailed_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kpi_drift_events TO authenticated;
GRANT ALL ON public.kpi_drift_events TO service_role;
ALTER TABLE public.kpi_drift_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm read" ON public.kpi_drift_events FOR SELECT TO authenticated USING (public.app_can_any(ARRAY['kpis','alerts'], 'read'));

CREATE OR REPLACE FUNCTION public.kpi_current_values(_days int DEFAULT 30)
RETURNS TABLE(metric text, value numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH sf AS (SELECT * FROM fulfillments WHERE shipped_at >= now() - make_interval(days => _days)),
  ord AS (SELECT DISTINCT order_id FROM sf),
  ordered AS (SELECT COALESCE(sum(l.qty),0) q FROM sales_order_lines l WHERE l.order_id IN (SELECT order_id FROM ord)),
  shipped AS (SELECT COALESCE(sum(fl.qty),0) q FROM fulfillment_lines fl JOIN fulfillments f ON f.id = fl.fulfillment_id
              WHERE f.order_id IN (SELECT order_id FROM ord) AND f.status IN ('shipped','delivered')),
  active AS (SELECT id, status FROM sales_orders WHERE status NOT IN ('draft','cancelled','delivered','shipped') AND order_date >= current_date - _days)
  SELECT 'on_time_ship_rate', CASE WHEN count(*) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE promised_date IS NULL OR shipped_at::date <= promised_date) / count(*), 1) END FROM sf
  UNION ALL
  SELECT 'fill_rate', CASE WHEN (SELECT q FROM ordered) = 0 THEN NULL ELSE round(100.0 * (SELECT q FROM shipped) / (SELECT q FROM ordered), 1) END
  UNION ALL
  SELECT 'backorder_rate', CASE WHEN count(*) = 0 THEN NULL ELSE round(100.0 * count(*) FILTER (WHERE status = 'partially_shipped') / count(*), 1) END FROM active;
$$;
REVOKE EXECUTE ON FUNCTION public.kpi_current_values(int) FROM PUBLIC, anon;

/* Logs a drift event (and in-app alert) when a KPI is off target; repeats at most once per 24h per metric. */
CREATE OR REPLACE FUNCTION public.check_kpi_drift() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; t numeric; off boolean; dir text; n int := 0;
BEGIN
  FOR r IN SELECT * FROM public.kpi_current_values(30) LOOP
    SELECT target INTO t FROM kpi_targets WHERE kpi_targets.metric = r.metric;
    CONTINUE WHEN t IS NULL OR r.value IS NULL;
    IF r.metric = 'backorder_rate' THEN off := r.value > t; dir := 'above'; ELSE off := r.value < t; dir := 'below'; END IF;
    CONTINUE WHEN NOT off;
    CONTINUE WHEN EXISTS (SELECT 1 FROM kpi_drift_events e WHERE e.metric = r.metric AND e.created_at > now() - interval '24 hours');
    INSERT INTO kpi_drift_events(metric, value, target, direction) VALUES (r.metric, r.value, t, dir);
    INSERT INTO notifications(entity_table, action, summary, payload)
      VALUES ('kpi_targets', 'kpi_drift', format('%s is %s%% — %s target of %s%%', replace(r.metric,'_',' '), r.value, dir, t), jsonb_build_object('metric', r.metric, 'value', r.value, 'target', t, 'link', '/kpis'));
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_kpi_drift() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.run_scheduled_housekeeping()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE sw jsonb; esc int; al int; due int; r jsonb; cleaned int; drift int; mail int;
BEGIN
  sw := public.sweep_exceptions();
  esc := COALESCE(public.escalate_exceptions(), 0);
  al := COALESCE(public.run_alert_rules(), 0);
  drift := COALESCE(public.check_kpi_drift(), 0);
  PERFORM public.expire_reservations();
  SELECT count(*) INTO due FROM public.integration_messages
   WHERE direction = 'outbound' AND status IN ('pending','failed') AND (next_retry_at IS NULL OR next_retry_at <= now());
  SELECT count(*) INTO mail FROM public.kpi_drift_events WHERE email_status = 'pending' AND created_at > now() - interval '2 days';
  IF due > 0 OR mail > 0 THEN
    PERFORM net.http_post(
      url := 'https://project--3bf5c787-2b7e-48a2-bdbd-e6fea460e0fc.lovable.app/api/public/integrations/scheduled',
      headers := jsonb_build_object('content-type','application/json','x-cron-token',(SELECT token FROM public.scheduler_token WHERE id = 1)),
      body := '{"source":"cron"}'::jsonb);
  END IF;
  DELETE FROM public.notifications WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS cleaned = ROW_COUNT;
  r := jsonb_build_object('queued', sw->'created', 'auto_resolved', sw->'auto_resolved', 'escalated', esc, 'alerts_fired', al, 'kpi_drift', drift, 'emails_due', mail, 'outbound_due', due, 'notifications_cleaned', cleaned);
  INSERT INTO public.scheduler_runs (source, result) VALUES ('database', r);
  DELETE FROM public.scheduler_runs WHERE ran_at < now() - interval '14 days';
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.scheduler_runs (source, ok, result) VALUES ('database', false, jsonb_build_object('error', SQLERRM));
  RETURN jsonb_build_object('error', SQLERRM);
END $function$;