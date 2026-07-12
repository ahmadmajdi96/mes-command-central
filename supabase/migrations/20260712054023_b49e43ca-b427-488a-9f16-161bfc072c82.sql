-- ============ integration_settings ============
CREATE TABLE public.integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  system text NOT NULL CHECK (system IN ('mes','qc','command_center')),
  base_url text,
  enabled boolean NOT NULL DEFAULT false,
  last_sync_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, system)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_settings TO authenticated;
GRANT ALL ON public.integration_settings TO service_role;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings read" ON public.integration_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own settings write" ON public.integration_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER integration_settings_updated BEFORE UPDATE ON public.integration_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ qc_inspections ============
CREATE TABLE public.qc_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  inspection_type text NOT NULL DEFAULT 'in_process',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','pass','fail','waived')),
  inspector text,
  sample_size int DEFAULT 1,
  defects_found int DEFAULT 0,
  notes text,
  inspected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_inspections TO authenticated;
GRANT ALL ON public.qc_inspections TO service_role;
ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qc read all" ON public.qc_inspections FOR SELECT TO authenticated USING (true);
CREATE POLICY "qc write staff" ON public.qc_inspections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'operator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'operator'));
CREATE TRIGGER qc_inspections_updated BEFORE UPDATE ON public.qc_inspections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ non_conformances ============
CREATE TABLE public.non_conformances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  number text NOT NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','contained','root_cause','closed')),
  description text,
  disposition text,
  raised_by text,
  raised_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.non_conformances TO authenticated;
GRANT ALL ON public.non_conformances TO service_role;
ALTER TABLE public.non_conformances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ncr read all" ON public.non_conformances FOR SELECT TO authenticated USING (true);
CREATE POLICY "ncr write staff" ON public.non_conformances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'operator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'operator'));
CREATE TRIGGER non_conformances_updated BEFORE UPDATE ON public.non_conformances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ downtime_events ============
CREATE TABLE public.downtime_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  workstation text,
  reason text NOT NULL,
  category text DEFAULT 'unplanned',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  minutes int GENERATED ALWAYS AS (CASE WHEN ended_at IS NOT NULL THEN GREATEST(0, EXTRACT(EPOCH FROM (ended_at - started_at))::int / 60) ELSE NULL END) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.downtime_events TO authenticated;
GRANT ALL ON public.downtime_events TO service_role;
ALTER TABLE public.downtime_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "downtime read all" ON public.downtime_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "downtime write admin/sup" ON public.downtime_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));
CREATE TRIGGER downtime_events_updated BEFORE UPDATE ON public.downtime_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ station_status ============
CREATE TABLE public.station_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_code text NOT NULL UNIQUE,
  name text NOT NULL,
  state text NOT NULL DEFAULT 'idle' CHECK (state IN ('running','idle','down','maintenance','offline')),
  current_wo_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  operator text,
  oee numeric(5,2),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.station_status TO authenticated;
GRANT ALL ON public.station_status TO service_role;
ALTER TABLE public.station_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "station read all" ON public.station_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "station write admin/sup" ON public.station_status FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));
CREATE TRIGGER station_status_updated BEFORE UPDATE ON public.station_status FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ kpi_snapshots ============
CREATE TABLE public.kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('mes','qc','command_center','oms')),
  metric text NOT NULL,
  value numeric NOT NULL,
  unit text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kpi_snapshots_source_metric_idx ON public.kpi_snapshots(source, metric, captured_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_snapshots TO authenticated;
GRANT ALL ON public.kpi_snapshots TO service_role;
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi read all" ON public.kpi_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpi write admin" ON public.kpi_snapshots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ integration_events ============
CREATE TABLE public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  payload jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX integration_events_created_idx ON public.integration_events(created_at DESC);
GRANT SELECT, INSERT ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events read all" ON public.integration_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events insert admin" ON public.integration_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.qc_inspections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.non_conformances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.downtime_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.station_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kpi_snapshots;