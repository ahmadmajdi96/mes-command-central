
CREATE TYPE public.request_direction AS ENUM ('outbound','inbound');
CREATE TYPE public.request_kind AS ENUM ('new_product','other');
CREATE TYPE public.request_status AS ENUM ('pending','in_review','approved','rejected','completed','cancelled','failed');

CREATE SEQUENCE IF NOT EXISTS public.product_request_number_seq;

CREATE TABLE public.product_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  kind public.request_kind NOT NULL DEFAULT 'new_product',
  direction public.request_direction NOT NULL,
  target_system TEXT NOT NULL,
  source_system TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_ref TEXT,
  delivery_status TEXT,
  delivery_error TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  requester_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_product_request_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v BIGINT;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    v := nextval('public.product_request_number_seq');
    NEW.number := 'PRQ-' || to_char(now(),'YYYY') || '-' || lpad(v::text,4,'0');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_product_requests_number BEFORE INSERT ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_product_request_number();

CREATE TRIGGER trg_product_requests_updated_at BEFORE UPDATE ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_product_requests_direction ON public.product_requests(direction);
CREATE INDEX idx_product_requests_status ON public.product_requests(status);
CREATE INDEX idx_product_requests_created_at ON public.product_requests(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_requests TO authenticated;
GRANT ALL ON public.product_requests TO service_role;
GRANT USAGE ON SEQUENCE public.product_request_number_seq TO authenticated;

ALTER TABLE public.product_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product requests readable by authenticated"
  ON public.product_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create product requests"
  ON public.product_requests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update product requests"
  ON public.product_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete product requests"
  ON public.product_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
