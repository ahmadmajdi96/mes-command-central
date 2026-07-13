import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { logAudit } from "./oms-db";

type T = Database["public"]["Tables"];
export type Batch = T["batches"]["Row"];
export type BatchInsert = Omit<T["batches"]["Insert"], "number"> & { number?: string };
export type BatchStatus = Database["public"]["Enums"]["batch_status"];

export const batchesKey = ["batches"] as const;

export function useBatches(productionOrderId?: string) {
  return useQuery({
    queryKey: productionOrderId ? ["batches", "po", productionOrderId] : batchesKey,
    queryFn: async (): Promise<Batch[]> => {
      let q = supabase.from("batches").select("*").order("created_at", { ascending: false }).limit(500);
      if (productionOrderId) q = q.eq("production_order_id", productionOrderId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: ["batch", id],
    enabled: !!id,
    queryFn: async (): Promise<Batch | null> => {
      if (!id) return null;
      const { data, error } = await supabase.from("batches").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BatchInsert) => {
      const { data, error } = await supabase
        .from("batches")
        .insert(input as T["batches"]["Insert"])
        .select()
        .single();
      if (error) throw error;
      await logAudit("batch.create", data.id, `Created ${data.number}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: batchesKey }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Batch> }) => {
      const { data, error } = await supabase.from("batches").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await logAudit("batch.update", id, `Updated ${data.number} → ${data.status}`);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: batchesKey });
      qc.invalidateQueries({ queryKey: ["batch", v.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("batches").delete().eq("id", id);
      if (error) throw error;
      await logAudit("batch.delete", id);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: batchesKey }),
    onError: (e: Error) => toast.error(e.message),
  });
}
