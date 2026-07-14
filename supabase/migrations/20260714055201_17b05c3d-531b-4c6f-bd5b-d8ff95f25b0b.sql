
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS acceptance_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "product-attachments read authed"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-attachments');

CREATE POLICY "product-attachments insert authed"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-attachments');

CREATE POLICY "product-attachments update authed"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-attachments');

CREATE POLICY "product-attachments delete authed"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-attachments');
