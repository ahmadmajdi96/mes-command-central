CREATE OR REPLACE FUNCTION public.log_order_milestone(_order uuid, _milestone text, _notes text)
RETURNS void LANGUAGE sql SET search_path=public AS $$
  INSERT INTO order_milestones(order_id, milestone, source, notes) VALUES (_order, _milestone, 'fulfillment', _notes);
$$;