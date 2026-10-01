import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "./oms-db";
import { invKey } from "./inventory-db";

const T = (name: string) => supabase.from(name as never);
const rpc = (fn: string, args: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

export interface Transition { id: string; entity: string; from_status: string; to_status: string; enabled: boolean; sla_hours: number | null; version: number }
export interface Milestone { id: string; order_id: string; milestone: string; from_status: string | null; to_status: string | null; source: string; actor_id: string | null; notes: string | null; at: string }
export interface RuleConditions { channel?: string; order_type?: string; customer_id?: string; product_id?: string; min_total?: string; max_total?: string }
export interface RuleAction { location_id?: string; route?: string; reason?: string }
export interface BusinessRule { id: string; name: string; rule_type: "sourcing" | "routing" | "hold"; conditions: RuleConditions; action: RuleAction; priority: number; active: boolean; effective_from: string | null; effective_to: string | null; notes: string | null; created_at: string; updated_at: string }
export interface RuleHistory { id: string; rule_id: string | null; change: string; snapshot: Partial<BusinessRule> | null; at: string }
export interface SourcingDecision { id: string; order_id: string; order_line_id: string; location_id: string | null; rule_id: string | null; rank: number; qty: number; status: string; failure_reason: string | null; created_at: string }
export interface MonitorRow { id: string; number: string; status: string; channel: string; route: string | null; hold_reason: string | null; customer_id: string | null; due_date: string | null; total: number; status_changed_at: string; created_at: string; hours_in_status: number; sla_hours: number | null; failed_steps: number; unallocated_qty: number; last_milestone: string | null }

export const orchKey = ["orchestration"] as const;
export const ORDER_STATUSES = ["draft", "confirmed", "on_hold", "sourced", "in_production", "partially_shipped", "shipped", "delivered", "cancelled"];
export const CHANNELS = ["direct", "web", "marketplace", "edi", "phone", "erp"];

async function rows<R>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<R[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as R[];
}

export const useTransitions = () => useQuery({ queryKey: [...orchKey, "transitions"], queryFn: () => rows<Transition>(T("workflow_transitions").select("*").order("from_status").order("to_status")) });
export const useRules = () => useQuery({ queryKey: [...orchKey, "rules"], queryFn: () => rows<BusinessRule>(T("business_rules").select("*").order("rule_type").order("priority")) });
export const useRuleHistory = () => useQuery({ queryKey: [...orchKey, "rule-history"], queryFn: () => rows<RuleHistory>(T("business_rule_history").select("*").order("at", { ascending: false }).limit(500)) });
export const useMonitor = () => useQuery({ queryKey: [...orchKey, "monitor"], queryFn: () => rows<MonitorRow>(T("v_order_monitor").select("*").order("status_changed_at")) });
export const useMilestones = (orderId: string) => useQuery({ queryKey: [...orchKey, "milestones", orderId], queryFn: () => rows<Milestone>(T("order_milestones").select("*").eq("order_id", orderId).order("at", { ascending: false })) });
export const useDecisions = (orderId: string) => useQuery({ queryKey: [...orchKey, "decisions", orderId], queryFn: () => rows<SourcingDecision>(T("sourcing_decisions").select("*").eq("order_id", orderId).neq("status", "superseded").order("created_at")) });

/** Legal next statuses for a given current status. */
export function useNextStatuses(current: string | undefined) {
  const { data = [] } = useTransitions();
  return data.filter((t) => t.entity === "sales_order" && t.enabled && t.from_status === current).map((t) => t.to_status);
}

function useM<V>(fn: (v: V) => Promise<unknown>, ok: string | ((r: any) => string)) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: orchKey }); qc.invalidateQueries({ queryKey: invKey }); qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success(typeof ok === "function" ? ok(r) : ok);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
const unwrap = async (p: PromiseLike<{ error: { message: string } | null; data?: unknown }>) => { const { error, data } = await p; if (error) throw new Error(error.message); return data; };

export const useSaveTransition = () => useM((v: Partial<Transition>) => unwrap(v.id ? T("workflow_transitions").update(v as never).eq("id", v.id) : T("workflow_transitions").insert({ entity: "sales_order", ...v } as never)), "Workflow updated");
export const useDeleteTransition = () => useM((id: string) => unwrap(T("workflow_transitions").delete().eq("id", id)), "Transition removed");
export const useSaveRule = () => useM(async (v: Partial<BusinessRule>) => {
  const r = await unwrap(v.id ? T("business_rules").update({ ...v, updated_at: new Date().toISOString() } as never).eq("id", v.id) : T("business_rules").insert(v as never));
  await logAudit("rule.save", v.name ?? "rule");
  return r;
}, "Rule saved");
export const useDeleteRule = () => useM((id: string) => unwrap(T("business_rules").delete().eq("id", id)), "Rule deleted");

export const useOrchestrate = () => useM(async (orderId: string) => {
  const r = await unwrap(rpc("orchestrate_order", { _order: orderId })) as { result: string; short_lines?: number; rule?: string };
  await logAudit("order.orchestrate", orderId, r.result);
  return r;
}, (r: { result: string; short_lines?: number; rule?: string }) =>
  r.result === "sourced" ? "Order fully sourced and allocated" :
  r.result === "on_hold" ? `Order put on hold by rule "${r.rule}"` :
  `Partially sourced — ${r.short_lines} line(s) short`);

export const useSetOrderStatus = () => useM(async (v: { id: string; status: string; hold_reason?: string | null }) => {
  await unwrap(T("sales_orders").update({ status: v.status, ...(v.hold_reason !== undefined ? { hold_reason: v.hold_reason } : {}) } as never).eq("id", v.id));
  await logAudit("order.status", v.id, v.status);
}, "Status updated");
