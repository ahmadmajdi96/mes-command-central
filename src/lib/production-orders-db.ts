import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { logAudit } from "./oms-db";

type T = Database["public"]["Tables"];
export type ProductionOrder = T["production_orders"]["Row"];
export type ProductionOrderInsert = Omit<T["production_orders"]["Insert"], "number"> & { number?: string };
export type ProductionOrderStatus = Database["public"]["Enums"]["production_order_status"];

export const productionOrdersKey = ["production_orders"] as const;

export function useProductionOrders() {
  return useQuery({
    queryKey: productionOrdersKey,
    queryFn: async (): Promise<ProductionOrder[]> => {
      const { data, error } = await supabase
        .from("production_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProductionOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["production_order", id],
    enabled: !!id,
    queryFn: async (): Promise<ProductionOrder | null> => {
      if (!id) return null;
      const { data, error } = await supabase.from("production_orders").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateProductionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProductionOrderInsert) => {
      const { data, error } = await supabase
        .from("production_orders")
        .insert(input as T["production_orders"]["Insert"])
        .select()
        .single();
      if (error) throw error;
      await logAudit("production_order.create", data.id, `Created ${data.number}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productionOrdersKey }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProductionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProductionOrder> }) => {
      const { data, error } = await supabase.from("production_orders").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await logAudit("production_order.update", id, `Updated ${data.number} → ${data.status}`);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: productionOrdersKey });
      qc.invalidateQueries({ queryKey: ["production_order", v.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteProductionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_orders").delete().eq("id", id);
      if (error) throw error;
      await logAudit("production_order.delete", id);
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productionOrdersKey }),
    onError: (e: Error) => toast.error(e.message),
  });
}
