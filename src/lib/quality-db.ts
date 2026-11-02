import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/components/form-dialog";

const db = supabase as any;
export const holdsKey = ["quality_holds"];
export const ncrKey = ["ncr_reports"];
export const capaKey = ["capas"];

export type QualityHold = { id: string; number: string; batch_id: string | null; production_order_id: string | null; product_id: string | null; lot_code: string | null; reason: string; status: "active" | "released"; source: string; release_reason: string | null; released_at: string | null; created_at: string };
export type Ncr = { id: string; number: string; title: string; description: string | null; source: string; severity: "minor" | "major" | "critical"; status: string; disposition: string | null; batch_id: string | null; production_order_id: string | null; product_id: string | null; return_id: string | null; hold_id: string | null; qty_affected: number | null; owner: string | null; closed_at: string | null; created_at: string };
export type Capa = { id: string; number: string; title: string; problem: string | null; root_cause: string | null; status: string; owner: string | null; due_date: string | null; effectiveness_check: string | null; effectiveness_verified: boolean; verified_by: string | null; closed_at: string | null; created_at: string };
export type CapaAction = { id: string; capa_id: string; kind: "corrective" | "preventive"; description: string; owner: string | null; due_date: string | null; done: boolean; done_at: string | null };
export type BatchRef = { id: string; number: string; lot_code: string | null; status: string; production_order_id: string | null; product_id: string | null };

const list = (table: string, key: string[]) => () => useQuery({
  queryKey: key,
  queryFn: async () => { const { data, error } = await db.from(table).select("*").order("created_at", { ascending: false }).limit(2000); if (error) throw error; return data ?? []; },
});
export const useHolds = list("quality_holds", holdsKey) as () => ReturnType<typeof useQuery<QualityHold[]>>;
export const useNcrs = list("ncr_reports", ncrKey) as () => ReturnType<typeof useQuery<Ncr[]>>;
export const useCapas = list("capas", capaKey) as () => ReturnType<typeof useQuery<Capa[]>>;

export function useBatchRefs() {
  return useQuery({ queryKey: ["batches", "refs"], queryFn: async (): Promise<BatchRef[]> => {
    const { data, error } = await db.from("batches").select("id, number, lot_code, status, production_order_id, product_id").order("created_at", { ascending: false }).limit(1000);
    if (error) throw error; return data ?? [];
  } });
}
export function useCapaActions() {
  return useQuery({ queryKey: [...capaKey, "actions"], queryFn: async (): Promise<CapaAction[]> => {
    const { data, error } = await db.from("capa_actions").select("*").order("created_at"); if (error) throw error; return data ?? [];
  } });
}
export function useCapaLinks() {
  return useQuery({ queryKey: [...capaKey, "links"], queryFn: async (): Promise<{ capa_id: string; ncr_id: string }[]> => {
    const { data, error } = await db.from("capa_ncr_links").select("capa_id, ncr_id"); if (error) throw error; return data ?? [];
  } });
}

/** Generic save/delete with toast + cache refresh. */
export function useSave(table: string, keys: string[][]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { id, ...rest } = row as { id?: string };
      const r = id ? await db.from(table).update(rest).eq("id", id) : await db.from(table).insert(rest);
      if (r.error) throw r.error;
    },
    onSuccess: () => keys.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  });
}
export function useRemove(table: string, keys: string[][]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from(table).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { keys.forEach((k) => qc.invalidateQueries({ queryKey: k })); toast.success("Deleted"); },
    onError: (e: unknown) => toast.error(friendlyError(e)),
  });
}
export function useLinkNcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ capa_id, ncr_id, link }: { capa_id: string; ncr_id: string; link: boolean }) => {
      const r = link ? await db.from("capa_ncr_links").insert({ capa_id, ncr_id }) : await db.from("capa_ncr_links").delete().eq("capa_id", capa_id).eq("ncr_id", ncr_id);
      if (r.error) throw r.error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: capaKey }),
    onError: (e: unknown) => toast.error(friendlyError(e)),
  });
}

/** Browser-side mirror of the database CAPA close rule, so people see why before saving. */
export function capaCloseBlockers(c: Pick<Capa, "root_cause" | "effectiveness_check" | "effectiveness_verified">, actions: Pick<CapaAction, "done">[]): string[] {
  const out: string[] = [];
  if (!c.root_cause?.trim()) out.push("Record the root cause");
  if (actions.length === 0) out.push("Add at least one action");
  else if (actions.some((a) => !a.done)) out.push("Finish every action");
  if (!c.effectiveness_check?.trim() || !c.effectiveness_verified) out.push("Verify effectiveness");
  return out;
}

export const isCapaOverdue = (c: Pick<Capa, "status" | "due_date">, now = new Date()) =>
  c.status !== "closed" && !!c.due_date && new Date(c.due_date + "T23:59:59") < now;
