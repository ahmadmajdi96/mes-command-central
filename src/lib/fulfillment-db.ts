import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "./oms-db";

const T = (name: string) => supabase.from(name as never);
const rpc = (fn: string, args: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

export const fulKey = ["fulfillment"] as const;
export const FUL_STATUSES = ["pending", "picking", "packed", "shipped", "delivered", "failed", "cancelled"] as const;
/** Allowed next steps — mirrors the database rule in set_fulfillment_status. */
export const FUL_NEXT: Record<string, string[]> = {
  pending: ["picking", "packed", "shipped", "failed", "cancelled"],
  picking: ["packed", "shipped", "failed", "cancelled"],
  packed: ["shipped", "failed", "cancelled"],
  failed: ["pending"],
  shipped: ["delivered"],
  delivered: [], cancelled: [],
};

export interface Fulfillment {
  id: string; number: string; order_id: string; location_id: string | null; status: string;
  carrier: string | null; tracking: string | null; shipment_id: string | null; promised_date: string | null;
  notes: string | null; failure_reason: string | null; shipped_at: string | null; delivered_at: string | null;
  status_changed_at: string; created_at: string;
  order_number?: string; customer_id?: string | null; location_code?: string | null;
  hours_in_status?: number; total_qty?: number; line_count?: number;
}
export interface FulLine { id: string; fulfillment_id: string; order_line_id: string; product_id: string | null; qty: number }
export interface FulEvent { id: string; fulfillment_id: string; from_status: string | null; to_status: string; notes: string | null; at: string }
export interface LineProgress { order_line_id: string; order_id: string; product_id: string | null; ordered: number; shipped: number; in_fulfillment: number; allocated_open: number }

export const backorderOf = (p: LineProgress) =>
  Math.max(0, Number(p.ordered) - Number(p.shipped) - Number(p.in_fulfillment) - Number(p.allocated_open));

export function useFulfillmentMonitor() {
  return useQuery({
    queryKey: [...fulKey, "monitor"],
    queryFn: async (): Promise<Fulfillment[]> => {
      const { data, error } = await T("v_fulfillment_monitor").select("*").order("created_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as Fulfillment[];
    },
  });
}

export function useLineProgressAll() {
  return useQuery({
    queryKey: [...fulKey, "progress"],
    queryFn: async (): Promise<LineProgress[]> => {
      const { data, error } = await T("v_line_fulfillment").select("*").limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as LineProgress[];
    },
  });
}

export function useOrderFulfillment(orderId: string) {
  return useQuery({
    queryKey: [...fulKey, "order", orderId],
    queryFn: async () => {
      const [f, p] = await Promise.all([
        T("v_fulfillment_monitor").select("*").eq("order_id", orderId).order("created_at"),
        T("v_line_fulfillment").select("*").eq("order_id", orderId),
      ]);
      if (f.error) throw f.error;
      if (p.error) throw p.error;
      const ful = (f.data ?? []) as unknown as Fulfillment[];
      const ids = ful.map((x) => x.id);
      let lines: FulLine[] = [], events: FulEvent[] = [];
      if (ids.length) {
        const [l, e] = await Promise.all([
          T("fulfillment_lines").select("*").in("fulfillment_id", ids),
          T("fulfillment_events").select("*").in("fulfillment_id", ids).order("at", { ascending: false }),
        ]);
        if (l.error) throw l.error;
        if (e.error) throw e.error;
        lines = (l.data ?? []) as unknown as FulLine[];
        events = (e.data ?? []) as unknown as FulEvent[];
      }
      return { fulfillments: ful, lines, events, progress: (p.data ?? []) as unknown as LineProgress[] };
    },
  });
}

function useFulMutation<V>(fn: (v: V) => Promise<unknown>, ok: (r: unknown, v: V) => string, audit?: (v: V) => [string, string, string?]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const { data, error } = await (fn(v) as any);
      if (error) throw new Error(error.message);
      if (audit) { const [a, e, d] = audit(v); await logAudit(a, e, d); }
      return data;
    },
    onSuccess: (r, v) => {
      ["fulfillment", "inventory", "orchestration", "orders", "shipments"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      qc.invalidateQueries();
      toast.success(ok(r, v));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useCreateFulfillments = () => useFulMutation(
  (orderId: string) => rpc("create_fulfillments", { _order: orderId }),
  (r) => `${r} fulfillment(s) created`, (id) => ["fulfillment.create", id]);

export const useSetFulfillmentStatus = () => useFulMutation(
  (v: { id: string; status: string; carrier?: string; tracking?: string; notes?: string }) =>
    rpc("set_fulfillment_status", { _id: v.id, _status: v.status, _carrier: v.carrier || null, _tracking: v.tracking || null, _notes: v.notes || null }),
  (_r, v) => `Fulfillment marked ${v.status}`, (v) => ["fulfillment." + v.status, v.id, v.notes]);
