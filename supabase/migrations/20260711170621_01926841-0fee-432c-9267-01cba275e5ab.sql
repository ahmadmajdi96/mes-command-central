
-- =========================
-- CUSTOMERS
-- =========================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  contact text,
  email text,
  phone text,
  address text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers read authed" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers manage by managers" ON public.customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'order_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'order_manager'));

-- =========================
-- PRODUCTS
-- =========================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  uom text NOT NULL DEFAULT 'EA',
  type text NOT NULL DEFAULT 'finished',
  standard_cost numeric NOT NULL DEFAULT 0,
  lead_time int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products read authed" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products manage by managers" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'order_manager') OR public.has_role(auth.uid(),'production_planner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'order_manager') OR public.has_role(auth.uid(),'production_planner'));

-- =========================
-- SALES ORDERS
-- =========================
CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  order_date date NOT NULL DEFAULT current_date,
  due_date date,
  total numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_orders TO authenticated;
GRANT ALL ON public.sales_orders TO service_role;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "so read authed" ON public.sales_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "so manage by managers" ON public.sales_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'order_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'order_manager'));

-- =========================
-- SALES ORDER LINES
-- =========================
CREATE TABLE public.sales_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  qty numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_lines TO authenticated;
GRANT ALL ON public.sales_order_lines TO service_role;
ALTER TABLE public.sales_order_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sol read authed" ON public.sales_order_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "sol manage by managers" ON public.sales_order_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'order_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'order_manager'));

-- =========================
-- WORK ORDERS
-- =========================
CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  production_order_ref text,
  seq int NOT NULL DEFAULT 10,
  operation text NOT NULL,
  workstation text,
  status text NOT NULL DEFAULT 'pending',
  operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  qty_target numeric NOT NULL DEFAULT 0,
  qty_produced numeric NOT NULL DEFAULT 0,
  qty_scrap numeric NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  labor_min int NOT NULL DEFAULT 0,
  progress int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wo read authed" ON public.work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "wo manage by production" ON public.work_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'production_planner') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'production_planner') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "wo operator update own" ON public.work_orders FOR UPDATE TO authenticated
  USING (operator_id = auth.uid()) WITH CHECK (operator_id = auth.uid());

-- =========================
-- SOP STEPS
-- =========================
CREATE TABLE public.sop_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  seq int NOT NULL,
  title text NOT NULL,
  instructions text,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sop_steps TO authenticated;
GRANT ALL ON public.sop_steps TO service_role;
ALTER TABLE public.sop_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop read authed" ON public.sop_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "sop manage by production" ON public.sop_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'production_planner') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'production_planner') OR public.has_role(auth.uid(),'supervisor'));
CREATE POLICY "sop operator update" ON public.sop_steps FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- =========================
-- INVENTORY TRANSACTIONS
-- =========================
CREATE TABLE public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  type text NOT NULL,
  qty numeric NOT NULL,
  reference text,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_transactions TO authenticated;
GRANT ALL ON public.inventory_transactions TO service_role;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv read authed" ON public.inventory_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "inv insert authed" ON public.inventory_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "inv manage by managers" ON public.inventory_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'supervisor'));

-- =========================
-- SHIPMENTS
-- =========================
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE NOT NULL,
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  carrier text,
  tracking text,
  status text NOT NULL DEFAULT 'draft',
  shipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shp read authed" ON public.shipments FOR SELECT TO authenticated USING (true);
CREATE POLICY "shp manage by managers" ON public.shipments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'order_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'order_manager'));

-- =========================
-- updated_at triggers
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sales_orders_updated_at BEFORE UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- Realtime
-- =========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sop_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_transactions;

-- Helpful indexes
CREATE INDEX ON public.sales_order_lines(order_id);
CREATE INDEX ON public.sop_steps(work_order_id);
CREATE INDEX ON public.inventory_transactions(product_id);
CREATE INDEX ON public.inventory_transactions(work_order_id);
CREATE INDEX ON public.shipments(order_id);
