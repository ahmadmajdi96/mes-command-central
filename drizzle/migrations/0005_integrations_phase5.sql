CREATE TABLE public.integration_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system text NOT NULL,
  name text NOT NULL,
  url text,
  enabled boolean NOT NULL DEFAULT true,
  events text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.integration_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  system text NOT NULL,
  direction text NOT NULL,
  message_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  endpoint_id uuid REFERENCES public.integration_endpoints(id) ON DELETE SET NULL,
  entity_table text, entity_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb,
  error text,
  signature_valid boolean,
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (system, direction, message_id)
);
CREATE INDEX integration_messages_status_idx ON public.integration_messages(status, next_retry_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_endpoints TO authenticated;
GRANT SELECT, UPDATE ON public.integration_messages TO authenticated;
GRANT ALL ON public.integration_endpoints, public.integration_messages TO service_role;
ALTER TABLE public.integration_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all integration_endpoints" ON public.integration_endpoints FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth read integration_messages" ON public.integration_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth update integration_messages" ON public.integration_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER integration_endpoints_updated_at BEFORE UPDATE ON public.integration_endpoints FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER integration_messages_updated_at BEFORE UPDATE ON public.integration_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Outbox: queue outbound messages to every enabled endpoint subscribed to the event
CREATE OR REPLACE FUNCTION public.queue_outbound(_event text, _entity_table text, _entity_id uuid, _payload jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ep record; n int := 0;
BEGIN
  FOR ep IN SELECT * FROM integration_endpoints WHERE enabled AND _event = ANY(events) LOOP
    INSERT INTO integration_messages(message_id, system, direction, message_type, status, endpoint_id, entity_table, entity_id, payload, next_retry_at)
    VALUES (gen_random_uuid()::text, ep.system, 'outbound', _event, 'pending', ep.id, _entity_table, _entity_id, _payload, now());
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.outbox_orders() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM queue_outbound(CASE WHEN TG_OP='INSERT' THEN 'order.created' ELSE 'order.status_changed' END, 'sales_orders', NEW.id,
      jsonb_build_object('order_number', NEW.number, 'status', NEW.status, 'previous_status', CASE WHEN TG_OP='UPDATE' THEN OLD.status END,
        'customer_id', NEW.customer_id, 'total', NEW.total, 'currency', NEW.currency, 'due_date', NEW.due_date, 'channel', NEW.channel));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_outbox_orders AFTER INSERT OR UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.outbox_orders();

CREATE OR REPLACE FUNCTION public.outbox_fulfillments() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o record; loc text; ev text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT number INTO o FROM sales_orders WHERE id=NEW.order_id;
  SELECT code INTO loc FROM locations WHERE id=NEW.location_id;
  ev := CASE WHEN NEW.status='pending' THEN 'fulfillment.instruction' ELSE 'fulfillment.status_changed' END;
  PERFORM queue_outbound(ev, 'fulfillments', NEW.id, jsonb_build_object(
    'fulfillment_number', NEW.number, 'order_number', o.number, 'location_code', loc, 'status', NEW.status,
    'carrier', NEW.carrier, 'tracking', NEW.tracking, 'promised_date', NEW.promised_date,
    'lines', (SELECT COALESCE(jsonb_agg(jsonb_build_object('sku', p.sku, 'qty', fl.qty)), '[]'::jsonb) FROM fulfillment_lines fl LEFT JOIN products p ON p.id=fl.product_id WHERE fl.fulfillment_id=NEW.id)));
  RETURN NEW;
END $$;
-- deferred so fulfillment lines exist when the instruction payload is built
CREATE CONSTRAINT TRIGGER trg_outbox_fulfillments AFTER INSERT OR UPDATE ON public.fulfillments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.outbox_fulfillments();

INSERT INTO integration_endpoints(system, name, events, enabled) VALUES
 ('erp','ERP', ARRAY['order.created','order.status_changed','fulfillment.status_changed'], false),
 ('wms','Warehouse (WMS)', ARRAY['fulfillment.instruction'], false),
 ('fulfillment','Fulfillment partner / 3PL', ARRAY['fulfillment.instruction'], false),
 ('channel','Sales channel', ARRAY['order.status_changed','fulfillment.status_changed'], false);

ALTER PUBLICATION supabase_realtime ADD TABLE public.integration_messages;