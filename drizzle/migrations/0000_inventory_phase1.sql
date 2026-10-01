CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'warehouse',
  address text,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  source_system text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  on_hand numeric NOT NULL DEFAULT 0,
  reserved numeric NOT NULL DEFAULT 0,
  available numeric GENERATED ALWAYS AS (on_hand - reserved) STORED,
  status text NOT NULL DEFAULT 'available',
  source_system text NOT NULL DEFAULT 'OMS',
  last_updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, location_id)
);
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  to_location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  type text NOT NULL,
  qty numeric NOT NULL,
  reference text,
  source_system text NOT NULL DEFAULT 'OMS',
  user_id uuid,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.supply (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'purchase_order',
  reference text,
  qty numeric NOT NULL,
  expected_date date,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id uuid NOT NULL REFERENCES public.sales_order_lines(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  qty numeric NOT NULL,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX reservations_one_active ON public.reservations(order_line_id, location_id) WHERE status = 'active';
CREATE TABLE public.allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id uuid NOT NULL REFERENCES public.sales_order_lines(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  qty numeric NOT NULL,
  status text NOT NULL DEFAULT 'allocated',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['locations','inventory_levels','inventory_movements','supply','reservations','allocations'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "auth all %s" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.inv_upsert_row(_p uuid, _l uuid) RETURNS public.inventory_levels
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r public.inventory_levels;
BEGIN
  INSERT INTO inventory_levels(product_id, location_id) VALUES (_p,_l) ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM inventory_levels WHERE product_id=_p AND location_id=_l FOR UPDATE;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.inv_move(_product uuid, _location uuid, _type text, _qty numeric, _to_location uuid DEFAULT NULL, _reference text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r public.inventory_levels; delta numeric;
BEGIN
  IF _qty IS NULL OR (_type <> 'adjustment' AND _qty <= 0) THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  r := inv_upsert_row(_product, _location);
  IF _type = 'receipt' THEN delta := _qty;
  ELSIF _type IN ('issue','transfer') THEN delta := -_qty;
  ELSIF _type = 'adjustment' THEN delta := _qty;
  ELSE RAISE EXCEPTION 'Unknown movement type %', _type; END IF;
  IF r.on_hand + delta < r.reserved THEN RAISE EXCEPTION 'Not enough unreserved stock (available %)', r.on_hand - r.reserved; END IF;
  UPDATE inventory_levels SET on_hand = on_hand + delta, last_updated = now() WHERE id = r.id;
  IF _type = 'transfer' THEN
    IF _to_location IS NULL OR _to_location = _location THEN RAISE EXCEPTION 'Choose a different destination'; END IF;
    PERFORM inv_upsert_row(_product, _to_location);
    UPDATE inventory_levels SET on_hand = on_hand + _qty, last_updated = now() WHERE product_id=_product AND location_id=_to_location;
  END IF;
  INSERT INTO inventory_movements(product_id, location_id, to_location_id, type, qty, reference, user_id)
  VALUES (_product, _location, _to_location, _type, _qty, _reference, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.reserve_stock(_line uuid, _location uuid, _qty numeric, _minutes integer DEFAULT 1440)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE l record; r public.inventory_levels; rid uuid; already numeric;
BEGIN
  SELECT id, order_id, product_id, qty INTO l FROM sales_order_lines WHERE id=_line;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Order line not found'; END IF;
  IF _qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT COALESCE(sum(qty),0) INTO already FROM reservations WHERE order_line_id=_line AND status='active';
  IF already + _qty > l.qty THEN RAISE EXCEPTION 'Cannot reserve more than ordered (% already reserved of %)', already, l.qty; END IF;
  IF EXISTS (SELECT 1 FROM reservations WHERE order_line_id=_line AND location_id=_location AND status='active') THEN
    RAISE EXCEPTION 'This line already has an active reservation at this location'; END IF;
  r := inv_upsert_row(l.product_id, _location);
  IF r.available < _qty THEN RAISE EXCEPTION 'Only % available at this location', r.available; END IF;
  UPDATE inventory_levels SET reserved = reserved + _qty, last_updated = now() WHERE id=r.id;
  INSERT INTO reservations(order_line_id, order_id, product_id, location_id, qty, expires_at)
  VALUES (_line, l.order_id, l.product_id, _location, _qty, CASE WHEN _minutes > 0 THEN now() + make_interval(mins => _minutes) END)
  RETURNING id INTO rid;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.release_reservation(_id uuid, _status text DEFAULT 'released')
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE res public.reservations;
BEGIN
  SELECT * INTO res FROM reservations WHERE id=_id FOR UPDATE;
  IF res.id IS NULL OR res.status <> 'active' THEN RETURN; END IF;
  PERFORM inv_upsert_row(res.product_id, res.location_id);
  UPDATE inventory_levels SET reserved = GREATEST(reserved - res.qty, 0), last_updated = now()
   WHERE product_id=res.product_id AND location_id=res.location_id;
  UPDATE reservations SET status=_status, updated_at=now() WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.expire_reservations() RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE x record; n integer := 0;
BEGIN
  FOR x IN SELECT id FROM reservations WHERE status='active' AND expires_at IS NOT NULL AND expires_at < now() LOOP
    PERFORM release_reservation(x.id, 'expired'); n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.allocate_line(_line uuid, _location uuid, _qty numeric)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE l record; already numeric; aid uuid; res record; r public.inventory_levels;
BEGIN
  SELECT id, order_id, product_id, qty INTO l FROM sales_order_lines WHERE id=_line;
  IF l.id IS NULL THEN RAISE EXCEPTION 'Order line not found'; END IF;
  IF _qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT COALESCE(sum(qty),0) INTO already FROM allocations WHERE order_line_id=_line AND status='allocated';
  IF already + _qty > l.qty THEN RAISE EXCEPTION 'Cannot allocate more than ordered (% already allocated of %)', already, l.qty; END IF;
  SELECT id, qty INTO res FROM reservations WHERE order_line_id=_line AND location_id=_location AND status='active' FOR UPDATE;
  IF res.id IS NOT NULL THEN
    PERFORM release_reservation(res.id, 'consumed');
  END IF;
  r := inv_upsert_row(l.product_id, _location);
  IF r.available < _qty THEN RAISE EXCEPTION 'Only % available at this location', r.available; END IF;
  UPDATE inventory_levels SET reserved = reserved + _qty, last_updated = now() WHERE id=r.id;
  INSERT INTO allocations(order_line_id, order_id, product_id, location_id, qty)
  VALUES (_line, l.order_id, l.product_id, _location, _qty) RETURNING id INTO aid;
  RETURN aid;
END $$;

CREATE OR REPLACE FUNCTION public.deallocate(_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a public.allocations;
BEGIN
  SELECT * INTO a FROM allocations WHERE id=_id FOR UPDATE;
  IF a.id IS NULL OR a.status <> 'allocated' THEN RETURN; END IF;
  UPDATE inventory_levels SET reserved = GREATEST(reserved - a.qty,0), last_updated=now()
   WHERE product_id=a.product_id AND location_id=a.location_id;
  UPDATE allocations SET status='deallocated', updated_at=now() WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.check_availability(_product uuid, _qty numeric)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  WITH av AS (
    SELECT COALESCE(sum(il.available) FILTER (WHERE il.status='available' AND loc.active),0) AS available
    FROM inventory_levels il JOIN locations loc ON loc.id=il.location_id WHERE il.product_id=_product
  ), sup AS (
    SELECT COALESCE(sum(qty),0) AS incoming, min(expected_date) AS next_date
    FROM supply WHERE product_id=_product AND status='open'
  ), po AS (
    SELECT COALESCE(sum(GREATEST(qty - qty_produced,0)),0) AS prod, min(planned_end) AS prod_date
    FROM production_orders WHERE product_id=_product AND status IN ('planned','released','in_progress')
  )
  SELECT jsonb_build_object(
    'requested', _qty,
    'available', av.available,
    'incoming', sup.incoming + po.prod,
    'atp', av.available + sup.incoming + po.prod,
    'supply_date', LEAST(sup.next_date, po.prod_date),
    'status', CASE WHEN av.available >= _qty THEN 'available'
                   WHEN av.available + sup.incoming + po.prod >= _qty THEN 'atp'
                   ELSE 'short' END)
  FROM av, sup, po;
$$;

CREATE OR REPLACE VIEW public.v_supply_demand WITH (security_invoker = true) AS
SELECT p.id AS product_id, p.sku, p.name,
  COALESCE((SELECT sum(on_hand) FROM inventory_levels WHERE product_id=p.id),0) AS on_hand,
  COALESCE((SELECT sum(reserved) FROM inventory_levels WHERE product_id=p.id),0) AS reserved,
  COALESCE((SELECT sum(l.qty) FROM sales_order_lines l JOIN sales_orders o ON o.id=l.order_id
     WHERE l.product_id=p.id AND o.status NOT IN ('delivered','cancelled','shipped')),0) AS demand,
  COALESCE((SELECT sum(qty) FROM supply WHERE product_id=p.id AND status='open'),0)
   + COALESCE((SELECT sum(GREATEST(qty-qty_produced,0)) FROM production_orders WHERE product_id=p.id AND status IN ('planned','released','in_progress')),0) AS incoming
FROM products p;
GRANT SELECT ON public.v_supply_demand TO authenticated;