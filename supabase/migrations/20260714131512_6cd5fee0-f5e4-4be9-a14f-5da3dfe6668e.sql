
ALTER TABLE public.order_feedback
  ADD COLUMN IF NOT EXISTS comments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS product_ratings jsonb NOT NULL DEFAULT '[]'::jsonb;
