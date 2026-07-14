import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "./oms-db";

export interface ReturnRow {
  id: string;
  number: string;
  order_id: string;
  customer_id: string | null;
  status: "requested" | "approved" | "rejected" | "refunded" | "closed";
  reason: string | null;
  notes: string | null;
  reorder_order_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReturnLine {
  id: string;
  return_id: string;
  product_id: string | null;
  sales_order_line_id: string | null;
  qty: number;
  unit_price: number;
  reason: string | null;
  created_at: string;
}

export interface Refund {
  id: string;
  return_id: string;
  amount: number;
  currency: string;
  method: string | null;
  reference: string | null;
  status: "pending" | "issued" | "failed";
  issued_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const returnsKey = ["returns"] as const;
export const returnLinesKey = (id: string) => ["return_lines", id] as const;
export const refundsKey = (id: string) => ["refunds", id] as const;

const T = (name: string) => supabase.from(name as never);

export function useReturns() {
  return useQuery({
    queryKey: returnsKey,
    queryFn: async (): Promise<ReturnRow[]> => {
      const { data, error } = await T("returns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ReturnRow[];
    },
  });
}

export function useReturn(id: string | undefined) {
  return useQuery({
    queryKey: ["return", id],
    enabled: !!id,
    queryFn: async (): Promise<ReturnRow | null> => {
      if (!id) return null;
      const { data, error } = await T("returns").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as unknown as ReturnRow) ?? null;
    },
  });
}

export function useReturnLines(returnId: string | undefined) {
  return useQuery({
    queryKey: returnLinesKey(returnId ?? ""),
    enabled: !!returnId,
    queryFn: async (): Promise<ReturnLine[]> => {
      if (!returnId) return [];
      const { data, error } = await T("return_lines").select("*").eq("return_id", returnId).order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as ReturnLine[];
    },
  });
}

export function useRefunds(returnId: string | undefined) {
  return useQuery({
    queryKey: refundsKey(returnId ?? ""),
    enabled: !!returnId,
    queryFn: async (): Promise<Refund[]> => {
      if (!returnId) return [];
      const { data, error } = await T("refunds").select("*").eq("return_id", returnId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Refund[];
    },
  });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { order_id: string; customer_id?: string | null; reason?: string; notes?: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await T("returns").insert({
        order_id: input.order_id,
        customer_id: input.customer_id ?? null,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        created_by: userRes?.user?.id ?? null,
      } as never).select().single();
      if (error) throw error;
      await logAudit("return.create", (data as { id: string }).id, `Created ${(data as { number: string }).number}`);
      return data as unknown as ReturnRow;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: returnsKey }); toast.success("Return created"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ReturnRow> }) => {
      const { data, error } = await T("returns").update(patch as never).eq("id", id).select().single();
      if (error) throw error;
      await logAudit("return.update", id, `→ ${(data as { status: string }).status}`);
      return data as unknown as ReturnRow;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: returnsKey }); qc.invalidateQueries({ queryKey: ["return", v.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await T("returns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: returnsKey }); toast.success("Return deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateReturnLine(returnId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ReturnLine>) => {
      const { error } = await T("return_lines").insert({ ...input, return_id: returnId } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: returnLinesKey(returnId) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateReturnLine(returnId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ReturnLine> }) => {
      const { error } = await T("return_lines").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: returnLinesKey(returnId) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteReturnLine(returnId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await T("return_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: returnLinesKey(returnId) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateRefund(returnId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { amount: number; currency?: string; method?: string; reference?: string; notes?: string; status?: Refund["status"] }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await T("refunds").insert({
        return_id: returnId,
        amount: input.amount,
        currency: input.currency ?? "USD",
        method: input.method ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        status: input.status ?? "issued",
        issued_at: (input.status ?? "issued") === "issued" ? new Date().toISOString() : null,
        created_by: userRes?.user?.id ?? null,
      } as never).select().single();
      if (error) throw error;
      await T("returns").update({ status: "refunded" } as never).eq("id", returnId);
      await logAudit("refund.create", (data as { id: string }).id, `Refunded ${input.amount}`);
      return data as unknown as Refund;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: refundsKey(returnId) });
      qc.invalidateQueries({ queryKey: returnsKey });
      qc.invalidateQueries({ queryKey: ["return", returnId] });
      toast.success("Refund recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRefund(returnId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await T("refunds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: refundsKey(returnId) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Clone the original order into a new sales_order + lines and link back on the return. */
export function useReorderFromReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ returnId, orderId }: { returnId: string; orderId: string }) => {
      const { data: original, error: e1 } = await supabase
        .from("sales_orders")
        .select("*, lines:sales_order_lines(*)")
        .eq("id", orderId)
        .single();
      if (e1) throw e1;
      const o = original as unknown as { customer_id: string | null; currency: string; notes: string | null; total: number; lines: Array<{ product_id: string | null; qty: number; unit_price: number; description: string | null }> };
      const { data: userRes } = await supabase.auth.getUser();
      const { data: newOrder, error: e2 } = await supabase
        .from("sales_orders")
        .insert({
          customer_id: o.customer_id,
          currency: o.currency,
          status: "draft",
          order_date: new Date().toISOString().slice(0, 10),
          notes: `Re-order from return`,
          total: o.total,
          created_by: userRes?.user?.id ?? null,
        } as never)
        .select()
        .single();
      if (e2) throw e2;
      const newOrderId = (newOrder as { id: string }).id;
      if (o.lines?.length) {
        const lines = o.lines.map((l) => ({
          sales_order_id: newOrderId,
          product_id: l.product_id,
          qty: l.qty,
          unit_price: l.unit_price,
          description: l.description,
        }));
        await supabase.from("sales_order_lines").insert(lines as never);
      }
      await T("returns").update({ reorder_order_id: newOrderId, status: "closed" } as never).eq("id", returnId);
      await logAudit("return.reorder", returnId, `Cloned to ${(newOrder as { number: string }).number}`);
      return newOrder as unknown as { id: string; number: string };
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: returnsKey });
      qc.invalidateQueries({ queryKey: ["return", v.returnId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Re-order created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
