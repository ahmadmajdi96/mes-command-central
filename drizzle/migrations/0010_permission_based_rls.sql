
CREATE OR REPLACE FUNCTION public.app_can_any(_res text[], _act text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.user_app_roles uar
      JOIN public.app_role_permissions p ON p.role_id = uar.role_id
      WHERE uar.user_id = auth.uid() AND p.resource = ANY(_res)
        AND ((_act='read' AND p.can_read) OR (_act='create' AND p.can_create)
          OR (_act='update' AND p.can_update) OR (_act='delete' AND p.can_delete)))
    OR (_act = 'read' AND NOT EXISTS (SELECT 1 FROM public.user_app_roles WHERE user_id = auth.uid()))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.app_can_any(text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_can_any(text[], text) TO authenticated;

DO $$
DECLARE
  m jsonb := '{
    "inventory_levels":["inventory","orders","fulfillments"],
    "inventory_movements":["inventory","orders","fulfillments"],
    "inventory_transactions":["inventory","orders","fulfillments"],
    "reservations":["inventory","orders","fulfillments"],
    "allocations":["inventory","orders","fulfillments"],
    "supply":["inventory"],
    "shipments":["shipments","fulfillments"],
    "fulfillments":["fulfillments","orders"],
    "fulfillment_lines":["fulfillments","orders"],
    "order_exceptions":["exceptions","orders","fulfillments","alerts"],
    "exception_comments":["exceptions"],
    "exception_assignment_rules":["exceptions"],
    "sales_orders":["orders"],
    "sales_order_lines":["orders"],
    "order_milestones":["orders"],
    "sourcing_decisions":["orders","orchestration"],
    "returns":["orders"],
    "return_lines":["orders"],
    "refunds":["orders"],
    "production_orders":["production_orders","batches","orders"],
    "batches":["batches","production_orders","orders"],
    "product_requests":["requests","orders","production_orders","batches","products"],
    "request_events":["requests","orders","production_orders","batches","products"],
    "product_routings":["requests","products"],
    "products":["products"],
    "customers":["customers"],
    "locations":["locations","inventory"],
    "business_rules":["rules"],
    "business_rule_history":["rules"],
    "workflow_transitions":["workflow"],
    "alert_rules":["alerts"],
    "kpi_snapshots":["kpis"],
    "kpi_targets":["kpis"],
    "integration_endpoints":["integrations"],
    "order_feedback":["feedback","orders"],
    "downtime_events":["production_orders"],
    "non_conformances":["production_orders"],
    "qc_inspections":["production_orders"],
    "station_status":["production_orders"],
    "work_orders":["production_orders"],
    "sop_steps":["production_orders"]
  }';
  t text; r text; pol record;
BEGIN
  FOR t IN SELECT jsonb_object_keys(m) LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
    SELECT 'ARRAY[' || string_agg(quote_literal(x), ',') || ']::text[]' INTO r FROM jsonb_array_elements_text(m->t) x;
    EXECUTE format('CREATE POLICY "perm read" ON public.%I FOR SELECT TO authenticated USING (public.app_can_any(%s, ''read''))', t, r);
    EXECUTE format('CREATE POLICY "perm insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.app_can_any(%s, ''create'') OR public.app_can_any(%s, ''update''))', t, r, r);
    EXECUTE format('CREATE POLICY "perm update" ON public.%I FOR UPDATE TO authenticated USING (public.app_can_any(%s, ''update'')) WITH CHECK (public.app_can_any(%s, ''update''))', t, r, r);
    EXECUTE format('CREATE POLICY "perm delete" ON public.%I FOR DELETE TO authenticated USING (public.app_can_any(%s, ''delete''))', t, r);
  END LOOP;
END $$;

-- Append-only logs
DROP POLICY IF EXISTS "auth insert fulfillment_events" ON public.fulfillment_events;
DROP POLICY IF EXISTS "auth read fulfillment_events" ON public.fulfillment_events;
CREATE POLICY "perm read" ON public.fulfillment_events FOR SELECT TO authenticated USING (public.app_can_any(ARRAY['fulfillments','orders'], 'read'));
CREATE POLICY "perm insert" ON public.fulfillment_events FOR INSERT TO authenticated WITH CHECK (public.app_can_any(ARRAY['fulfillments','orders'], 'update') AND (actor_id IS NULL OR actor_id = auth.uid()));

DROP POLICY IF EXISTS "events insert authed" ON public.integration_events;
DROP POLICY IF EXISTS "events read all" ON public.integration_events;
CREATE POLICY "perm read" ON public.integration_events FOR SELECT TO authenticated USING (public.app_can_any(ARRAY['integrations','requests'], 'read'));
CREATE POLICY "perm insert" ON public.integration_events FOR INSERT TO authenticated WITH CHECK (public.app_can_any(ARRAY['integrations','requests','products'], 'create'));

DROP POLICY IF EXISTS "auth read integration_messages" ON public.integration_messages;
DROP POLICY IF EXISTS "auth update integration_messages" ON public.integration_messages;
CREATE POLICY "perm read" ON public.integration_messages FOR SELECT TO authenticated USING (public.app_can_any(ARRAY['integrations'], 'read'));
CREATE POLICY "perm update" ON public.integration_messages FOR UPDATE TO authenticated USING (public.app_can_any(ARRAY['integrations'], 'update')) WITH CHECK (public.app_can_any(ARRAY['integrations'], 'update'));

DROP POLICY IF EXISTS "audit read all authed" ON public.audit_log;
CREATE POLICY "perm read" ON public.audit_log FOR SELECT TO authenticated USING (public.app_can_any(ARRAY['audit'], 'read'));

DROP POLICY IF EXISTS "auth read scheduler runs" ON public.scheduler_runs;
CREATE POLICY "perm read" ON public.scheduler_runs FOR SELECT TO authenticated USING (public.app_can_any(ARRAY['integrations'], 'read'));

-- Roles & permissions: see your own, or manage with permission
DROP POLICY IF EXISTS "app_roles read authed" ON public.app_roles;
CREATE POLICY "roles read" ON public.app_roles FOR SELECT TO authenticated USING (
  public.app_can_any(ARRAY['roles','users'], 'read') AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.user_app_roles u WHERE u.user_id = auth.uid() AND u.role_id = app_roles.id) OR public.has_permission(auth.uid(),'roles','read')));
DROP POLICY IF EXISTS "app_role_permissions read authed" ON public.app_role_permissions;
CREATE POLICY "perms read" ON public.app_role_permissions FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'roles','read')
  OR EXISTS (SELECT 1 FROM public.user_app_roles u WHERE u.user_id = auth.uid() AND u.role_id = app_role_permissions.role_id));
DROP POLICY IF EXISTS "user_app_roles read authed" ON public.user_app_roles;
CREATE POLICY "assignments read" ON public.user_app_roles FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'users','read'));

-- Notifications: written only by the system trigger; read per data area; mark-read via function
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
    WHEN _t LIKE 'inventory%' OR _t IN ('reservations','allocations','supply') THEN ARRAY['inventory']
    WHEN _t LIKE 'integration%' THEN ARRAY['integrations']
    ELSE ARRAY['alerts','orders']
  END
$$;
ALTER FUNCTION public.notify_change() SECURITY DEFINER;
ALTER FUNCTION public.notify_change() SET search_path = public;
DROP POLICY IF EXISTS notifications_read_all ON public.notifications;
DROP POLICY IF EXISTS notifications_update_all ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_all ON public.notifications;
CREATE POLICY "notifications read" ON public.notifications FOR SELECT TO authenticated USING (public.app_can_any(public.notification_resource(entity_table), 'read'));

CREATE OR REPLACE FUNCTION public.mark_notifications_read(_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  UPDATE public.notifications SET read_by = array_append(read_by, auth.uid())
   WHERE (_ids IS NULL OR id = ANY(_ids)) AND NOT (auth.uid() = ANY(read_by))
     AND public.app_can_any(public.notification_resource(entity_table), 'read');
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;

-- File storage: products files need product rights, return labels need order rights
DROP POLICY IF EXISTS "product-attachments read authed" ON storage.objects;
DROP POLICY IF EXISTS "product-attachments insert authed" ON storage.objects;
DROP POLICY IF EXISTS "product-attachments update authed" ON storage.objects;
DROP POLICY IF EXISTS "product-attachments delete authed" ON storage.objects;
CREATE POLICY "attachments read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='product-attachments' AND public.app_can_any(CASE WHEN (storage.foldername(name))[1]='returns' THEN ARRAY['orders'] ELSE ARRAY['products'] END, 'read'));
CREATE POLICY "attachments insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='product-attachments' AND owner = auth.uid() AND public.app_can_any(CASE WHEN (storage.foldername(name))[1]='returns' THEN ARRAY['orders'] ELSE ARRAY['products'] END, 'update'));
CREATE POLICY "attachments update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='product-attachments' AND public.app_can_any(CASE WHEN (storage.foldername(name))[1]='returns' THEN ARRAY['orders'] ELSE ARRAY['products'] END, 'update'));
CREATE POLICY "attachments delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='product-attachments' AND public.app_can_any(CASE WHEN (storage.foldername(name))[1]='returns' THEN ARRAY['orders'] ELSE ARRAY['products'] END, 'delete'));

-- Lock down internal security-definer helpers
REVOKE EXECUTE ON FUNCTION public.run_scheduled_housekeeping() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_outbound(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.outbox_orders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.outbox_fulfillments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sweep_exceptions() FROM PUBLIC, anon;
