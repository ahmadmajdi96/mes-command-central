
DROP POLICY IF EXISTS "products manage by managers" ON public.products;
CREATE POLICY "products manage authed" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "inv manage by managers" ON public.inventory_transactions;
CREATE POLICY "inv manage authed" ON public.inventory_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wo manage by production" ON public.work_orders;
CREATE POLICY "wo manage authed" ON public.work_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sop manage by production" ON public.sop_steps;
CREATE POLICY "sop manage authed" ON public.sop_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "downtime write admin/sup" ON public.downtime_events;
CREATE POLICY "downtime manage authed" ON public.downtime_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "kpi write admin" ON public.kpi_snapshots;
CREATE POLICY "kpi manage authed" ON public.kpi_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ncr write staff" ON public.non_conformances;
CREATE POLICY "ncr manage authed" ON public.non_conformances FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "qc write staff" ON public.qc_inspections;
CREATE POLICY "qc manage authed" ON public.qc_inspections FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "station write admin/sup" ON public.station_status;
CREATE POLICY "station manage authed" ON public.station_status FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "events insert admin" ON public.integration_events;
CREATE POLICY "events insert authed" ON public.integration_events FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete product requests" ON public.product_requests;
CREATE POLICY "product_requests delete authed" ON public.product_requests FOR DELETE TO authenticated USING (true);
