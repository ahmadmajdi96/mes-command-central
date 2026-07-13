ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.products ALTER COLUMN batching_limit TYPE INTEGER USING (batching_limit::integer);