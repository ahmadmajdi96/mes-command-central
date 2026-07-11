
DROP POLICY IF EXISTS "sop operator update" ON public.sop_steps;
CREATE POLICY "sop operator update own wo" ON public.sop_steps FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.work_orders wo WHERE wo.id = sop_steps.work_order_id AND wo.operator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.work_orders wo WHERE wo.id = sop_steps.work_order_id AND wo.operator_id = auth.uid()));
