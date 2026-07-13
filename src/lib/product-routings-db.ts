import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
export type ProductRouting = T["product_routings"]["Row"];

export function useProductRoutings(productId: string | undefined) {
  return useQuery({
    queryKey: ["product_routings", productId],
    enabled: !!productId,
    queryFn: async (): Promise<ProductRouting[]> => {
      if (!productId) return [];
      const { data, error } = await supabase
        .from("product_routings")
        .select("*")
        .eq("product_id", productId)
        .order("seq", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function createRoutingsFromSteps(args: {
  requestId: string;
  productId: string | null;
  steps: Array<{ sequence?: number; station_id?: string | null; notes?: string | null; operation?: string | null; setup_min?: number; run_min?: number }>;
}) {
  if (!args.productId || !args.steps.length) return { inserted: 0 };
  // Clear old routings for this product to avoid duplicates.
  await supabase.from("product_routings").delete().eq("product_id", args.productId);
  const rows = args.steps.map((s, i) => ({
    request_id: args.requestId,
    product_id: args.productId!,
    seq: s.sequence ?? i + 1,
    station_id: s.station_id || null,
    operation: s.operation ?? null,
    notes: s.notes ?? null,
    setup_min: s.setup_min ?? 0,
    run_min: s.run_min ?? 0,
  }));
  const { error } = await supabase.from("product_routings").insert(rows as never);
  if (error) throw error;
  return { inserted: rows.length };
}

export function useDeleteRouting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const { error } = await supabase.from("product_routings").delete().eq("id", id);
      if (error) throw error;
      return { id, productId };
    },
    onSuccess: (r) => qc.invalidateQueries({ queryKey: ["product_routings", r.productId] }),
  });
}

export function useStations() {
  return useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("station_status")
        .select("id,station_code,name,state")
        .order("station_code");
      if (error) throw error;
      return data ?? [];
    },
  });
}
