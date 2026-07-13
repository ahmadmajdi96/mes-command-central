import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { pushToSister } from "./integrations-client";
import { logAudit } from "./oms-db";
import { addRequestEvent } from "./request-events-db";
import { createRoutingsFromSteps } from "./product-routings-db";



type T = Database["public"]["Tables"];
export type ProductRequest = T["product_requests"]["Row"];
export type ProductRequestInsert = Omit<T["product_requests"]["Insert"], "number"> & { number?: string };
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
      const insertRow = { ...input, requester_id: userRes?.user?.id ?? null } as T["product_requests"]["Insert"];
      const { data, error } = await supabase
        .from("product_requests")
        .insert({ ...input, requester_id: userRes?.user?.id ?? null } as never)
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

/** Approve an inbound request: flip status, log request_event, generate product_routings from payload.steps. */
export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data: cur } = await supabase.from("product_requests").select("*").eq("id", id).single();
      if (!cur) throw new Error("Request not found");
      const from = cur.status as string;
      const { data, error } = await supabase
        .from("product_requests")
        .update({ status: "approved" as never })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await addRequestEvent(id, "request.approved", from, "approved", notes);
      const payload = (cur.payload ?? {}) as Record<string, unknown>;
      const steps = Array.isArray(payload.steps) ? (payload.steps as never[]) : [];
      if (cur.product_id && steps.length > 0) {
        const res = await createRoutingsFromSteps({ requestId: id, productId: cur.product_id, steps });
        await addRequestEvent(id, "routings.created", null, null, `Created ${res.inserted} routing steps`);
      }
      await logAudit("product_request.approve", id, `${cur.number} approved`);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: productRequestsKey });
      qc.invalidateQueries({ queryKey: ["request_events", v.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data: cur } = await supabase.from("product_requests").select("status,number").eq("id", id).single();
      const from = (cur?.status ?? null) as string | null;
      const { data, error } = await supabase
        .from("product_requests")
        .update({ status: "rejected" as never })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await addRequestEvent(id, "request.rejected", from, "rejected", notes);
      await logAudit("product_request.reject", id, `${cur?.number ?? id} rejected`);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: productRequestsKey });
      qc.invalidateQueries({ queryKey: ["request_events", v.id] });
    },
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

  // Load the request row to build a payload that matches the QC system's
  // public.requests contract: { kind, title, description, requester_id, payload }.
  const { data: req } = await supabase
    .from("product_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  const qcPayload = {
    kind: "new_product" as const,
    title: req?.title ?? "New product request",
    description: req?.description ?? null,
    requester_id: uid,
    assignee_id: null,
    payload: payload,
    source: {
      system: "CORTA OMS",
      request_id: requestId,
      number: req?.number ?? null,
    },
  };

  const res = await pushToSister(settings.base_url, qcPayload);

  await supabase.from("product_requests").update({
    delivery_status: res.ok ? "delivered" : "failed",
    delivery_error: res.ok ? null : ("error" in res ? res.error : null),
  }).eq("id", requestId);

  await supabase.from("integration_events").insert({
    system: "qc",
    direction: "outbound",
    event_type: "new_product_request",
    payload: qcPayload as never,
    status: res.ok ? "delivered" : "failed",
  } as never);

  return res;
}
