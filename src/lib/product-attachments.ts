import { supabase } from "@/integrations/supabase/client";

export type ProductAttachment = {
  path: string;
  name: string;
  size: number;
  type: string;
  uploaded_at: string;
};

const BUCKET = "product-attachments";

export async function uploadProductFiles(folderId: string, files: File[]): Promise<ProductAttachment[]> {
  const out: ProductAttachment[] = [];
  for (const f of files) {
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folderId}/${Date.now()}-${safe}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    out.push({
      path,
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
      uploaded_at: new Date().toISOString(),
    });
  }
  return out;
}

export async function deleteProductFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function signedUrlFor(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
