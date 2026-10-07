DROP POLICY IF EXISTS "roles read" ON public.app_roles;
CREATE POLICY "roles read" ON public.app_roles FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_permission(auth.uid(),'roles','read') OR public.has_permission(auth.uid(),'users','read')
  OR EXISTS (SELECT 1 FROM public.user_app_roles u WHERE u.user_id = auth.uid() AND u.role_id = app_roles.id));