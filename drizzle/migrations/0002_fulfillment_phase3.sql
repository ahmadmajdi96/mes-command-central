CREATE TABLE public.fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text,
  order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  carrier text, tracking text,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  promised_date date,
  notes text,
  failure_reason text,
  shipped_at timestamptz, delivered_at timestamptz,
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fulfillment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  order_line_id uuid NOT NULL REFERENCES public.sales_order_lines(id) ON DELETE CASCADE,
  allocation_id uuid REFERENCES public.allocations(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id),
  qty numeric NOT NULL CHECK (qty > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fulfillment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES public.fulfillments(id) ON DELETE CASCADE,
  from_status text, to_status text NOT NULL, notes text,
  actor_id uuid DEFAULT auth.uid(),
  at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS fulfillment_id uuid REFERENCES public.fulfillments(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fulfillments, public.fulfillment_lines, public.fulfillment_events TO authenticated;
GRANT ALL ON public.fulfillments, public.fulfillment_lines, public.fulfillment_events TO service_role;
ALTER TABLE public.fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all fulfillments" ON public.fulfillments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all fulfillment_lines" ON public.fulfillment_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read fulfillment_events" ON public.fulfillment_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert fulfillment_events" ON public.fulfillment_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_fulfillment_number() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n int; y text := to_char(now(),'YYYY');
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT COALESCE(max(substring(number from '\d+$')::int),0)+1 INTO n FROM fulfillments WHERE number LIKE 'FUL-'||y||'-%';
    NEW.number := 'FUL-'||y||'-'||lpad(n::text,4,'0');
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_set_fulfillment_number BEFORE INSERT ON public.fulfillments FOR EACH ROW EXECUTE FUNCTION public.set_fulfillment_number();
CREATE TRIGGER fulfillments_updated_at BEFORE UPDATE ON public.fulfillments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_notify_fulfillments AFTER INSERT OR DELETE OR UPDATE ON public.fulfillments FOR EACH ROW EXECUTE FUNCTION public.notify_change();

-- Per-line progress: ordered, shipped, in open fulfillments, allocated but not yet fulfilled, backorder
CREATE OR REPLACE VIEW public.v_line_fulfillment WITH (security_invoker=true) AS
SELECT l.id AS order_line_id, l.order_id, l.product_id, l.qty AS ordered,
  COALESCE((SELECT sum(fl.qty) FROM fulfillment_lines fl JOIN fulfillments f ON f.id=fl.fulfillment_id WHERE fl.order_line_id=l.id AND f.status IN ('shipped','delivered')),0) AS shipped,
  COALESCE((SELECT sum(fl.qty) FROM fulfillment_lines fl JOIN fulfillments f ON f.id=fl.fulfillment_id WHERE fl.order_line_id=l.id AND f.status IN ('pending','picking','packed')),0) AS in_fulfillment,
  COALESCE((SELECT sum(a.qty) FROM allocations a WHERE a.order_line_id=l.id AND a.status='allocated'
     AND NOT EXISTS (SELECT 1 FROM fulfillment_lines fl JOIN fulfillments f ON f.id=fl.fulfillment_id WHERE fl.allocation_id=a.id AND f.status NOT IN ('cancelled','failed'))),0) AS allocated_open
FROM sales_order_lines l;
GRANT SELECT ON public.v_line_fulfillment TO authenticated;

CREATE OR REPLACE VIEW public.v_fulfillment_monitor WITH (security_invoker=true) AS
SELECT f.*, o.number AS order_number, o.customer_id, loc.code AS location_code,
  EXTRACT(EPOCH FROM (now()-f.status_changed_at))/3600 AS hours_in_status,
  (SELECT COALESCE(sum(qty),0) FROM fulfillment_lines WHERE fulfillment_id=f.id) AS total_qty,
  (SELECT count(*) FROM fulfillment_lines WHERE fulfillment_id=f.id) AS line_count
FROM fulfillments f JOIN sales_orders o ON o.id=f.order_id LEFT JOIN locations loc ON loc.id=f.location_id;
GRANT SELECT ON public.v_fulfillment_monitor TO authenticated;

-- Create fulfillments from open allocations, one per location (split fulfillment)
CREATE OR REPLACE FUNCTION public.create_fulfillments(_order uuid) RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE loc uuid; fid uuid; cnt int := 0; o record;
BEGIN
  SELECT id, status, due_date INTO o FROM sales_orders WHERE id=_order FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status IN ('draft','cancelled','on_hold','delivered') THEN RAISE EXCEPTION 'Order is % — fulfillment not possible', o.status; END IF;
  FOR loc IN SELECT DISTINCT a.location_id FROM allocations a WHERE a.order_id=_order AND a.status='allocated'
     AND NOT EXISTS (SELECT 1 FROM fulfillment_lines fl JOIN fulfillments f ON f.id=fl.fulfillment_id WHERE fl.allocation_id=a.id AND f.status NOT IN ('cancelled','failed'))
  LOOP
    INSERT INTO fulfillments(order_id, location_id, promised_date) VALUES (_order, loc, o.due_date) RETURNING id INTO fid;
    INSERT INTO fulfillment_lines(fulfillment_id, order_line_id, allocation_id, product_id, qty)
    SELECT fid, a.order_line_id, a.id, a.product_id, a.qty FROM allocations a WHERE a.order_id=_order AND a.location_id=loc AND a.status='allocated'
      AND NOT EXISTS (SELECT 1 FROM fulfillment_lines fl JOIN fulfillments f ON f.id=fl.fulfillment_id WHERE fl.allocation_id=a.id AND f.status NOT IN ('cancelled','failed'));
    INSERT INTO fulfillment_events(fulfillment_id, to_status, notes) VALUES (fid, 'pending', 'Created from allocations');
    cnt := cnt + 1;
  END LOOP;
  IF cnt = 0 THEN RAISE EXCEPTION 'No allocated stock waiting for fulfillment — run sourcing or allocate first'; END IF;
  PERFORM log_order_milestone(_order, 'fulfillment_created', cnt||' fulfillment(s) created');
  RETURN cnt;
END $$;

CREATE OR REPLACE FUNCTION public.try_order_status(_order uuid, _to text) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE cur text;
BEGIN
  SELECT status INTO cur FROM sales_orders WHERE id=_order;
  IF cur = _to THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM workflow_transitions WHERE entity='sales_order' AND from_status=cur AND to_status=_to AND enabled) THEN
    UPDATE sales_orders SET status=_to WHERE id=_order;
  END IF;
END $$;

-- Move a fulfillment through its lifecycle; shipping issues stock, creates the shipment and updates the order
CREATE OR REPLACE FUNCTION public.set_fulfillment_status(_id uuid, _status text, _carrier text DEFAULT NULL, _tracking text DEFAULT NULL, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE f fulfillments; ok boolean; fl record; sid uuid; open_left numeric; all_delivered boolean;
BEGIN
  SELECT * INTO f FROM fulfillments WHERE id=_id FOR UPDATE;
  IF f.id IS NULL THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  ok := (f.status, _status) IN (('pending','picking'),('pending','packed'),('pending','shipped'),('pending','cancelled'),('pending','failed'),
        ('picking','packed'),('picking','shipped'),('picking','cancelled'),('picking','failed'),
        ('packed','shipped'),('packed','cancelled'),('packed','failed'),('failed','pending'),('shipped','delivered'));
  IF NOT ok THEN RAISE EXCEPTION 'Fulfillment cannot move from "%" to "%"', f.status, _status; END IF;
  IF _status = 'failed' AND COALESCE(_notes,'') = '' THEN RAISE EXCEPTION 'Give a reason for the failure'; END IF;

  IF _status = 'shipped' THEN
    FOR fl IN SELECT * FROM fulfillment_lines WHERE fulfillment_id=_id LOOP
      UPDATE inventory_levels SET on_hand = GREATEST(on_hand - fl.qty,0), reserved = GREATEST(reserved - fl.qty,0), last_updated=now()
       WHERE product_id=fl.product_id AND location_id=f.location_id;
      INSERT INTO inventory_movements(product_id, location_id, type, qty, reference, user_id)
       VALUES (fl.product_id, f.location_id, 'issue', fl.qty, f.number, auth.uid());
      UPDATE allocations SET status='shipped', updated_at=now() WHERE id=fl.allocation_id;
    END LOOP;
    INSERT INTO shipments(order_id, carrier, tracking, status, shipped_at, fulfillment_id)
     VALUES (f.order_id, COALESCE(_carrier,f.carrier), COALESCE(_tracking,f.tracking), 'shipped', now(), _id) RETURNING id INTO sid;
    UPDATE fulfillments SET status='shipped', shipped_at=now(), shipment_id=sid, carrier=COALESCE(_carrier,carrier), tracking=COALESCE(_tracking,tracking), status_changed_at=now() WHERE id=_id;
    SELECT COALESCE(sum(ordered - shipped),0) INTO open_left FROM v_line_fulfillment WHERE order_id=f.order_id;
    PERFORM try_order_status(f.order_id, CASE WHEN open_left <= 0 THEN 'shipped' ELSE 'partially_shipped' END);
    PERFORM log_order_milestone(f.order_id, 'fulfillment_shipped', f.number||CASE WHEN open_left>0 THEN ' · '||open_left||' units still open' ELSE '' END);
  ELSIF _status = 'delivered' THEN
    UPDATE fulfillments SET status='delivered', delivered_at=now(), status_changed_at=now() WHERE id=_id;
    UPDATE shipments SET status='delivered' WHERE id=f.shipment_id;
    SELECT COALESCE(sum(ordered - shipped),0) INTO open_left FROM v_line_fulfillment WHERE order_id=f.order_id;
    SELECT bool_and(status IN ('delivered','cancelled','failed')) INTO all_delivered FROM fulfillments WHERE order_id=f.order_id;
    IF open_left <= 0 AND all_delivered THEN PERFORM try_order_status(f.order_id, 'delivered'); END IF;
    PERFORM log_order_milestone(f.order_id, 'fulfillment_delivered', f.number);
  ELSE
    UPDATE fulfillments SET status=_status, status_changed_at=now(),
      failure_reason = CASE WHEN _status='failed' THEN _notes ELSE failure_reason END,
      carrier=COALESCE(_carrier,carrier), tracking=COALESCE(_tracking,tracking) WHERE id=_id;
    IF _status IN ('cancelled','failed') THEN PERFORM log_order_milestone(f.order_id, 'fulfillment_'||_status, f.number||COALESCE(' · '||_notes,'')); END IF;
  END IF;
  INSERT INTO fulfillment_events(fulfillment_id, from_status, to_status, notes) VALUES (_id, f.status, _status, _notes);
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.fulfillments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fulfillment_events;