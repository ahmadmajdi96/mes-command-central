
-- Sequences
CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.sales_order_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.shipment_number_seq START 1;

-- Customer code trigger
CREATE OR REPLACE FUNCTION public.set_customer_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v BIGINT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    v := nextval('public.customer_code_seq');
    NEW.code := 'CUS-' || lpad(v::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_customer_code ON public.customers;
CREATE TRIGGER trg_set_customer_code
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_code();

-- Sales order number trigger
CREATE OR REPLACE FUNCTION public.set_sales_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v BIGINT;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    v := nextval('public.sales_order_number_seq');
    NEW.number := 'SO-' || to_char(now(),'YYYY') || '-' || lpad(v::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_sales_order_number ON public.sales_orders;
CREATE TRIGGER trg_set_sales_order_number
  BEFORE INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_sales_order_number();

-- Shipment number trigger
CREATE OR REPLACE FUNCTION public.set_shipment_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v BIGINT;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    v := nextval('public.shipment_number_seq');
    NEW.number := 'SHP-' || to_char(now(),'YYYY') || '-' || lpad(v::text, 4, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_shipment_number ON public.shipments;
CREATE TRIGGER trg_set_shipment_number
  BEFORE INSERT ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_shipment_number();

-- Uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS customers_code_key ON public.customers (code);
CREATE UNIQUE INDEX IF NOT EXISTS sales_orders_number_key ON public.sales_orders (number);
CREATE UNIQUE INDEX IF NOT EXISTS shipments_number_key ON public.shipments (number);

-- Advance sequences past existing values so no collisions
SELECT setval('public.customer_code_seq',
  GREATEST(1, COALESCE((SELECT MAX((regexp_replace(code, '\D', '', 'g'))::bigint) FROM public.customers WHERE code ~ '\d'), 0)));
SELECT setval('public.sales_order_number_seq',
  GREATEST(1, COALESCE((SELECT MAX((regexp_replace(split_part(number,'-',3), '\D', '', 'g'))::bigint) FROM public.sales_orders WHERE number ~ 'SO-'), 0)));
SELECT setval('public.shipment_number_seq',
  GREATEST(1, COALESCE((SELECT MAX((regexp_replace(split_part(number,'-',3), '\D', '', 'g'))::bigint) FROM public.shipments WHERE number ~ 'SHP-'), 0)));
