
-- Enums
CREATE TYPE public.batch_status AS ENUM ('planned','in_progress','on_hold','released','completed','rejected');
CREATE TYPE public.production_order_status AS ENUM ('planned','released','in_progress','completed','cancelled');

-- Sequences
CREATE SEQUENCE public.batch_number_seq;
CREATE SEQUENCE public.production_order_number_seq;

-- Production Orders
CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE SET NULL,
  qty numeric NOT NULL DEFAULT 0,
  qty_produced numeric NOT NULL DEFAULT 0,
  qty_scrap numeric NOT NULL DEFAULT 0,
  status public.production_order_status NOT NULL DEFAULT 'planned',
  priority integer NOT NULL DEFAULT 3,
  planned_start date,
  planned_end date,
  actual_start timestamptz,
  actual_end timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO authenticated;
GRANT ALL ON public.production_orders TO service_role;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_orders manage authed" ON public.production_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Batches
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text UNIQUE,
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  qty numeric NOT NULL DEFAULT 0,
  qty_good numeric NOT NULL DEFAULT 0,
  qty_scrap numeric NOT NULL DEFAULT 0,
  status public.batch_status NOT NULL DEFAULT 'planned',
  lot_code text,
  expiry_date date,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.batches TO authenticated;
GRANT ALL ON public.batches TO service_role;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches manage authed" ON public.batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Request events (audit trail)
CREATE TABLE public.request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.product_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  actor_id uuid,
  notes text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_events TO authenticated;
GRANT ALL ON public.request_events TO service_role;
ALTER TABLE public.request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "request_events manage authed" ON public.request_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX request_events_request_id_idx ON public.request_events(request_id, created_at DESC);

-- Product routings (created on approve)
CREATE TABLE public.product_routings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.product_requests(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  station_id uuid REFERENCES public.station_status(id) ON DELETE SET NULL,
  operation text,
  notes text,
  setup_min integer NOT NULL DEFAULT 0,
  run_min integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_routings TO authenticated;
GRANT ALL ON public.product_routings TO service_role;
ALTER TABLE public.product_routings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_routings manage authed" ON public.product_routings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX product_routings_product_seq_idx ON public.product_routings(product_id, seq);

-- Number auto-gen triggers
CREATE OR REPLACE FUNCTION public.set_production_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v BIGINT;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    v := nextval('public.production_order_number_seq');
    NEW.number := 'PO-' || to_char(now(),'YYYY') || '-' || lpad(v::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.set_batch_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v BIGINT;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    v := nextval('public.batch_number_seq');
    NEW.number := 'BATCH-' || to_char(now(),'YYYY') || '-' || lpad(v::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_set_po_number BEFORE INSERT ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.set_production_order_number();

CREATE TRIGGER trg_set_batch_number BEFORE INSERT ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.set_batch_number();

CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_batch_updated_at BEFORE UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_routing_updated_at BEFORE UPDATE ON public.product_routings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_events;
