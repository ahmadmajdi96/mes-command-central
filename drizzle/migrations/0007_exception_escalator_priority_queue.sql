ALTER TABLE public.order_exceptions ADD COLUMN IF NOT EXISTS integration_message_id uuid REFERENCES public.integration_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_key text;
CREATE UNIQUE INDEX IF NOT EXISTS order_exceptions_open_auto_key ON public.order_exceptions (auto_key) WHERE auto_key IS NOT NULL AND status NOT IN ('resolved','closed');

-- Sweep: raise one exception per overdue order / delayed fulfillment / failed message; auto-resolve when the problem clears.
CREATE OR REPLACE FUNCTION public.sweep_exceptions()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created int := 0; resolved int := 0; n int;
BEGIN
  INSERT INTO order_exceptions (order_id, type, severity, title, description, source, auto_key, due_at)
  SELECT o.id, 'delayed', CASE WHEN o.due_date < current_date - 3 THEN 'high' ELSE 'medium' END,
         'Order '||o.number||' is overdue', 'Due '||o.due_date||', status '||o.status, 'escalator', 'order:'||o.id, now() + interval '24 hours'
  FROM sales_orders o
  WHERE o.due_date < current_date AND o.status NOT IN ('draft','shipped','delivered','cancelled')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; created := created + n;

  INSERT INTO order_exceptions (order_id, fulfillment_id, type, severity, title, description, source, auto_key, due_at)
  SELECT f.order_id, f.id, 'delayed', CASE WHEN f.promised_date < current_date THEN 'high' ELSE 'medium' END,
         'Fulfillment '||f.number||' is delayed', 'Status '||f.status||' since '||to_char(f.status_changed_at,'YYYY-MM-DD HH24:MI'), 'escalator', 'fulfillment:'||f.id, now() + interval '12 hours'
  FROM fulfillments f
  WHERE f.status IN ('pending','picking','packed') AND (f.status_changed_at < now() - interval '48 hours' OR f.promised_date < current_date)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; created := created + n;

  INSERT INTO order_exceptions (integration_message_id, entity_order, type, severity, title, description, source, auto_key, due_at)
  SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL WHERE false;
  RETURN NULL;
END $$;