-- lovable-cron-fallback-reviewed: user explicitly requested time-based escalation of overdue exceptions and alert-rule checks every few minutes; consolidated into one job that only calls out over HTTP when outbound messages are due
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.scheduler_token (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'));
GRANT ALL ON public.scheduler_token TO service_role;
ALTER TABLE public.scheduler_token ENABLE ROW LEVEL SECURITY;
INSERT INTO public.scheduler_token (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.scheduler_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL DEFAULT true,
  result jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.scheduler_runs TO authenticated;
GRANT ALL ON public.scheduler_runs TO service_role;
ALTER TABLE public.scheduler_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read scheduler runs" ON public.scheduler_runs FOR SELECT TO authenticated USING (true);
CREATE INDEX scheduler_runs_ran_at_idx ON public.scheduler_runs (ran_at DESC);

ALTER TABLE public.integration_messages ADD COLUMN IF NOT EXISTS ai_explanation jsonb, ADD COLUMN IF NOT EXISTS ai_explained_at timestamptz;

CREATE OR REPLACE FUNCTION public.run_scheduled_housekeeping()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE esc int; al int; due int; r jsonb;
BEGIN
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
  r := jsonb_build_object('escalated', esc, 'alerts_fired', al, 'outbound_due', due);
  INSERT INTO public.scheduler_runs (source, result) VALUES ('database', r);
  DELETE FROM public.scheduler_runs WHERE ran_at < now() - interval '14 days';
  RETURN r;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.scheduler_runs (source, ok, result) VALUES ('database', false, jsonb_build_object('error', SQLERRM));
  RETURN jsonb_build_object('error', SQLERRM);
END $$;
REVOKE ALL ON FUNCTION public.run_scheduled_housekeeping() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'oms-housekeeping'; END $$;
SELECT cron.schedule('oms-housekeeping', '*/5 * * * *', $$SELECT public.run_scheduled_housekeeping();$$);