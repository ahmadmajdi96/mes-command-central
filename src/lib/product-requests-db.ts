import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { pushToSister } from "./integrations-client";
import { logAudit } from "./oms-db";

type T = Database["public"]["Tables"];
export type ProductRequest = T["product_requests"]["Row"];
export type ProductRequestInsert = T["product_requests"]["Insert"];
export type RequestDirection = Database["public"]["Enums"]["request_direction"];
export type RequestStatus = Database["public"]["Enums"]["request_status"];

export const productRequestsKey = ["product_requests"] as const;

export function useProductRequests() {
  return useQuery({
    queryKey: productRequestsKey,
    queryFn: async (): Promise<ProductRequest[]> => {
      const { data, error } = await supabase
        .from("product_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateProductRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProductRequestInsert) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("product_requests")
        .insert({ ...input, requester_id: userRes?.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      await logAudit("product_request.create", data.id, `${data.direction} request ${data.number} → ${data.target_system}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productRequestsKey }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateProductRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProductRequest> }) => {
      const { data, error } = await supabase.from("product_requests").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await logAudit("product_request.update", id, `Status → ${data.status}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productRequestsKey }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Look up the QC base URL for the current user, then attempt an HTTP push. */
export async function deliverRequestToQc(requestId: string, payload: unknown) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return { ok: false, error: "Not signed in" };
  const { data: settings } = await supabase
    .from("integration_settings")
    .select("base_url,enabled")
    .eq("user_id", uid)
    .eq("system", "qc")
    .maybeSingle();

  if (!settings?.base_url || settings.enabled === false) {
    await supabase.from("product_requests").update({
      delivery_status: "skipped",
      delivery_error: "QC base URL not configured",
    }).eq("id", requestId);
    return { ok: false, error: "QC base URL not configured" };
  }

  const res = await pushToSister(settings.base_url, {
    type: "new_product_request",
    request_id: requestId,
    payload,
  });

  await supabase.from("product_requests").update({
    delivery_status: res.ok ? "delivered" : "failed",
    delivery_error: res.ok ? null : ("error" in res ? res.error : null),
  }).eq("id", requestId);

  await supabase.from("integration_events").insert({
    system: "qc",
    direction: "outbound",
    event_type: "new_product_request",
    payload: payload as never,
    status: res.ok ? "delivered" : "failed",
  } as never);

  return res;
}
