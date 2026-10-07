import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "./oms-db";

const T = (name: string) => supabase.from(name as never);
const rpc = (fn: string, args: Record<string, unknown> = {}) => (supabase.rpc as any)(fn, args);

export const excKey = ["exceptions"] as const;
export const EXC_TYPES = ["sourcing_failed", "fulfillment_failed", "delayed", "stock_shortage", "address_issue", "payment_issue", "damaged", "customer_request", "integration_failed", "alert", "other"];
export const EXC_SEVERITIES = ["low", "medium", "high", "critical"];
export const EXC_STATUSES = ["open", "in_progress", "escalated", "resolved", "closed"];
export const ALERT_METRICS: Record<string, string> = {
  orders_past_sla: "Orders past their time limit",
  orders_overdue: "Overdue orders (past due date)",
  messages_failed: "Failed integration messages",
  orders_on_hold: "Orders on hold",
  fulfillments_delayed: "Delayed fulfillments",
  fulfillments_failed: "Failed fulfillments",
  open_exceptions: "Open exceptions",
  backorder_units: "Backordered units",
  returns_pending: "Returns waiting",
  low_stock: "Products at or below reorder point",
};

export interface OrderException {
  id: string; number: string; order_id: string | null; fulfillment_id: string | null; type: string; severity: string; status: string;
  owner_id: string | null; title: string; description: string | null; resolution: string | null; due_at: string;
  escalation_level: number; escalated_at: string | null; resolved_at: string | null; source: string; created_at: string; updated_at: string;
}
export interface ExcComment { id: string; exception_id: string; body: string; author_id: string | null; created_at: string }
export interface AlertRule { id: string; name: string; metric: string; threshold: number; severity: string; create_exception: boolean; enabled: boolean; last_fired_at: string | null; last_count: number | null }
export interface KpiTarget { id: string; metric: string; target: number }
export interface Person { id: string; display_name: string | null; email: string | null }

const listQ = <R,>(key: string, table: string, order = "created_at", asc = false) => () => useQuery({
  queryKey: [...excKey, key],
  queryFn: async (): Promise<R[]> => {
    const { data, error } = await T(table).select("*").order(order, { ascending: asc }).limit(2000);
    if (error) throw error;
    return (data ?? []) as unknown as R[];
  },
});
export const useExceptions = listQ<OrderException>("list", "order_exceptions");
export const useAlertRules = listQ<AlertRule>("alerts", "alert_rules");
export const useKpiTargets = listQ<KpiTarget>("kpi", "kpi_targets", "metric", true);
export const usePeople = listQ<Person>("people", "profiles", "email", true);

export function useExceptionComments(id: string | null) {
  return useQuery({
    queryKey: [...excKey, "comments", id], enabled: !!id,
    queryFn: async (): Promise<ExcComment[]> => {
      const { data, error } = await T("exception_comments").select("*").eq("exception_id", id!).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ExcComment[];
    },
  });
}

function useM<V>(fn: (v: V) => PromiseLike<{ data?: unknown; error: { message: string } | null }>, ok: string | ((r: unknown) => string), audit?: (v: V) => [string, string, string?]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const { data, error } = await fn(v);
      if (error) throw new Error(error.message);
      if (audit) { const [a, e, d] = audit(v); await logAudit(a, e, d); }
      return data;
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: excKey }); qc.invalidateQueries({ queryKey: ["notifications"] }); toast.success(typeof ok === "string" ? ok : ok(r)); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const useSaveException = () => useM(
  (v: Partial<OrderException>) => v.id ? T("order_exceptions").update(v as never).eq("id", v.id) : T("order_exceptions").insert(v as never),
  "Exception saved", (v) => ["exception." + (v.id ? "update" : "create"), v.id ?? v.title ?? "exception", v.status]);
export const useDeleteException = () => useM((id: string) => T("order_exceptions").delete().eq("id", id), "Exception deleted");
export const useAddComment = () => useM((v: { exception_id: string; body: string }) => T("exception_comments").insert(v as never), "Comment added");
export const useEscalate = () => useM(async () => {
  const sw = await rpc("sweep_exceptions"); if (sw.error) return sw;
  const es = await rpc("escalate_exceptions"); if (es.error) return es;
  return { data: { ...(sw.data ?? {}), escalated: es.data ?? 0 }, error: null };
}, (r: any) => `${r?.created ?? 0} new in queue · ${r?.auto_resolved ?? 0} auto-resolved · ${r?.escalated ?? 0} escalated`);

export interface QueueRow extends OrderException { priority_score: number; order_number: string | null; fulfillment_number: string | null; message_type: string | null; message_system: string | null; integration_message_id: string | null }
export const usePriorityQueue = () => useQuery({
  queryKey: [...excKey, "queue"],
  queryFn: async (): Promise<QueueRow[]> => {
    const { data, error } = await T("v_exception_queue").select("*").order("priority_score", { ascending: false }).limit(500);
    if (error) throw error;
    return (data ?? []) as unknown as QueueRow[];
  },
  refetchInterval: 60_000,
});

export const useSaveAlertRule = () => useM(
  (v: Partial<AlertRule>) => v.id ? T("alert_rules").update(v as never).eq("id", v.id) : T("alert_rules").insert(v as never),
  "Alert rule saved", (v) => ["alert_rule.save", v.name ?? "rule"]);
export const useDeleteAlertRule = () => useM((id: string) => T("alert_rules").delete().eq("id", id), "Alert rule deleted");
export const useRunAlerts = () => useM(() => rpc("run_alert_rules"), (r) => `${r ?? 0} alert(s) fired`);

export const useSaveKpiTarget = () => useM((v: { id: string; target: number }) => T("kpi_targets").update({ target: v.target, updated_at: new Date().toISOString() } as never).eq("id", v.id), "Target updated");

export const useReceiveReturn = () => useM((v: { id: string; location: string }) => rpc("receive_return", { _return: v.id, _location: v.location }), "Return received", (v) => ["return.receive", v.id]);
export const useDisposition = () => useM(
  (v: { line: string; disposition: string; condition: string; notes: string }) => rpc("disposition_return_line", { _line: v.line, _disposition: v.disposition, _condition: v.condition || null, _notes: v.notes || null }),
  "Decision saved", (v) => ["return.disposition", v.line, v.disposition]);
export const useUpdateReturnShipping = () => useM(
  (v: { id: string; return_carrier: string; return_tracking: string; return_shipment_status: string }) => T("returns").update({ return_carrier: v.return_carrier || null, return_tracking: v.return_tracking || null, return_shipment_status: v.return_shipment_status } as never).eq("id", v.id),
  "Return shipment updated");

export const ageHours = (iso: string) => (Date.now() - new Date(iso).getTime()) / 36e5;
export const isOpenExc = (e: OrderException) => !["resolved", "closed"].includes(e.status);
