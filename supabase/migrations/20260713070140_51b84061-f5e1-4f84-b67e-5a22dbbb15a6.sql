
DROP POLICY IF EXISTS "customers manage by managers" ON public.customers;
CREATE POLICY "customers manage authed" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN
  EXECUTE (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON public.sales_orders;', policyname), ' ') FROM pg_policies WHERE tablename='sales_orders');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "sales_orders read authed" ON public.sales_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_orders manage authed" ON public.sales_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN
  EXECUTE (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON public.sales_order_lines;', policyname), ' ') FROM pg_policies WHERE tablename='sales_order_lines');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "sales_order_lines read authed" ON public.sales_order_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_order_lines manage authed" ON public.sales_order_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN
  EXECUTE (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON public.shipments;', policyname), ' ') FROM pg_policies WHERE tablename='shipments');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "shipments read authed" ON public.shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "shipments manage authed" ON public.shipments FOR ALL TO authenticated USING (true) WITH CHECK (true);
