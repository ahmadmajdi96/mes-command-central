-- =========================
-- RETURNS / REFUNDS / RE-ORDER
-- =========================
CREATE TABLE public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested', -- requested | approved | rejected | refunded | closed
  reason TEXT,
  notes TEXT,
  reorder_order_id UUID REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE SEQUENCE IF NOT EXISTS public.return_number_seq START 1;
CREATE OR REPLACE FUNCTION public.set_return_number() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v BIGINT;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    v := nextval('public.return_number_seq');
    NEW.number := 'RET-' || to_char(now(),'YYYY') || '-' || lpad(v::text,4,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_set_return_number BEFORE INSERT ON public.returns FOR EACH ROW EXECUTE FUNCTION public.set_return_number();
CREATE TRIGGER trg_returns_updated BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;
GRANT USAGE ON SEQUENCE public.return_number_seq TO authenticated, service_role;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "returns_all_auth" ON public.returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sales_order_line_id UUID REFERENCES public.sales_order_lines(id) ON DELETE SET NULL,
  qty NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_lines TO authenticated;
GRANT ALL ON public.return_lines TO service_role;
ALTER TABLE public.return_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return_lines_all_auth" ON public.return_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT, -- cash | card | bank_transfer | store_credit
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | issued | failed
  issued_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_refunds_updated BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refunds_all_auth" ON public.refunds FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================
-- NOTIFICATIONS + change trigger
-- =========================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_table TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL, -- insert | update | delete
  summary TEXT,
  actor_id UUID,
  payload JSONB,
  read_by UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_read_all" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "notifications_update_all" ON public.notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notifications_insert_all" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.notify_change() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
  v_id UUID;
  v_action TEXT;
  v_summary TEXT;
  v_actor UUID;
BEGIN
  v_action := lower(TG_OP);
  IF TG_OP = 'DELETE' THEN
    v_id := (row_to_json(OLD)->>'id')::uuid;
  ELSE
    v_id := (row_to_json(NEW)->>'id')::uuid;
  END IF;
  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN OTHERS THEN v_actor := NULL;
  END;
  v_summary := TG_TABLE_NAME || ' ' || v_action;
  INSERT INTO public.notifications(entity_table, entity_id, action, summary, actor_id, payload)
  VALUES (TG_TABLE_NAME, v_id, v_action, v_summary, v_actor,
    CASE WHEN TG_OP='DELETE' THEN row_to_json(OLD)::jsonb ELSE row_to_json(NEW)::jsonb END);
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'sales_orders','customers','products','shipments','product_requests',
    'production_orders','batches','returns','refunds','return_lines','sales_order_lines'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_%1$s ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_notify_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.notify_change()', t);
  END LOOP;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.returns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.return_lines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.refunds;