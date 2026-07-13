ALTER TABLE public.products ADD COLUMN IF NOT EXISTS batching_limit numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales_order_lines ADD COLUMN IF NOT EXISTS batch_index integer;
ALTER TABLE public.sales_order_lines ADD COLUMN IF NOT EXISTS batch_of integer;