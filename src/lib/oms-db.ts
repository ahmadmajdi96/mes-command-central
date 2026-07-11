import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type Customer = Tables["customers"]["Row"];
export type Product = Tables["products"]["Row"];
export type SalesOrder = Tables["sales_orders"]["Row"];
export type SalesOrderLine = Tables["sales_order_lines"]["Row"];
export type WorkOrder = Tables["work_orders"]["Row"];
export type SopStep = Tables["sop_steps"]["Row"];
export type InventoryTxn = Tables["inventory_transactions"]["Row"];
export type Shipment = Tables["shipments"]["Row"];

export type OrderWithCustomer = SalesOrder & { customer?: Pick<Customer, "id" | "name" | "code"> | null; lines_count?: number };
export type ShipmentWithOrder = Shipment & { order?: Pick<SalesOrder, "id" | "number" | "customer_id"> | null };

/* ----------------------------- Audit log ------------------------------ */
export async function logAudit(action: string, entity: string, detail?: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return;
  await supabase.from("audit_log").insert({ action, entity, detail: detail ?? null, user_id: uid });
}

/* ----------------------------- Realtime ------------------------------ */
export function useRealtimeInvalidate(table: keyof Tables, keys: QueryKey[]) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`rt-${String(table)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: String(table) }, () => {
        keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}

/* ----------------------------- Customers ----------------------------- */
export const customersKey = ["customers"] as const;

export function useCustomers() {
  return useQuery({
    queryKey: customersKey,
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Customer> & { name: string }) => {
      const { data, error } = await supabase.from("customers").insert(input).select().single();
      if (error) throw error;
      await logAudit("customer.create", data.id, `Created customer ${data.name}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKey }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Customer> }) => {
      const { data, error } = await supabase.from("customers").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await logAudit("customer.update", id, `Updated customer ${data.name}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKey }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
      await logAudit("customer.delete", id, "Deleted customer");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: customersKey }),
  });
}

/* ----------------------------- Products ----------------------------- */
export const productsKey = ["products"] as const;

export function useProducts() {
  return useQuery({
    queryKey: productsKey,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase.from("products").select("*").order("sku");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Product> & { sku: string; name: string }) => {
      const { data, error } = await supabase.from("products").insert(input).select().single();
      if (error) throw error;
      await logAudit("product.create", data.id, `Created ${data.sku}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKey }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Product> }) => {
      const { data, error } = await supabase.from("products").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await logAudit("product.update", id, `Updated ${data.sku}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKey }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      await logAudit("product.delete", id, "Deleted product");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: productsKey }),
  });
}

/* --------------------------- Sales Orders --------------------------- */
export const ordersKey = ["orders"] as const;
export const orderKey = (id: string) => ["orders", id] as const;

export function useOrders() {
  return useQuery({
    queryKey: ordersKey,
    queryFn: async (): Promise<OrderWithCustomer[]> => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*, customer:customers(id,name,code), lines:sales_order_lines(id)")
        .order("order_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, lines_count: r.lines?.length ?? 0 }));
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKey(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*, customer:customers(*), lines:sales_order_lines(*, product:products(id,sku,name))")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SalesOrder> & { number: string }) => {
      const { data, error } = await supabase.from("sales_orders").insert(input).select().single();
      if (error) throw error;
      await logAudit("sales_order.create", data.id, `Created ${data.number}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ordersKey }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, note }: { id: string; patch: Partial<SalesOrder>; note?: string }) => {
      const { data, error } = await supabase.from("sales_orders").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await logAudit("sales_order.update", id, note ?? `Updated ${data.number}`);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ordersKey });
      qc.invalidateQueries({ queryKey: orderKey(v.id) });
    },
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_orders").delete().eq("id", id);
      if (error) throw error;
      await logAudit("sales_order.delete", id, "Deleted sales order");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ordersKey }),
  });
}

export function useBulkUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status, label }: { ids: string[]; status: string; label: string }) => {
      const { error } = await supabase.from("sales_orders").update({ status }).in("id", ids);
      if (error) throw error;
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (uid) {
        await supabase.from("audit_log").insert(
          ids.map((id) => ({ action: "sales_order.bulk_update", entity: id, detail: `${label} → ${status}`, user_id: uid })),
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ordersKey }),
  });
}

/* ------------------------- Sales Order Lines ------------------------ */
export function useCreateOrderLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SalesOrderLine> & { order_id: string }) => {
      const { data, error } = await supabase.from("sales_order_lines").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ordersKey });
      if (d?.order_id) qc.invalidateQueries({ queryKey: orderKey(d.order_id) });
    },
  });
}

export function useDeleteOrderLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, orderId }: { id: string; orderId: string }) => {
      const { error } = await supabase.from("sales_order_lines").delete().eq("id", id);
      if (error) throw error;
      return orderId;
    },
    onSuccess: (orderId) => {
      qc.invalidateQueries({ queryKey: ordersKey });
      qc.invalidateQueries({ queryKey: orderKey(orderId) });
    },
  });
}

/* ---------------------------- Work Orders --------------------------- */
export const workOrdersKey = ["work_orders"] as const;
export const workOrderKey = (id: string) => ["work_orders", id] as const;

export function useWorkOrders() {
  return useQuery({
    queryKey: workOrdersKey,
    queryFn: async (): Promise<WorkOrder[]> => {
      const { data, error } = await supabase.from("work_orders").select("*").order("number");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWorkOrder(id: string) {
  return useQuery({
    queryKey: workOrderKey(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("work_orders").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkOrder> & { number: string; operation: string }) => {
      const { data, error } = await supabase.from("work_orders").insert(input).select().single();
      if (error) throw error;
      await logAudit("work_order.create", data.id, `Created ${data.number}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workOrdersKey }),
  });
}

export function useUpdateWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, note }: { id: string; patch: Partial<WorkOrder>; note?: string }) => {
      const { data, error } = await supabase.from("work_orders").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await logAudit("work_order.update", id, note ?? `Updated ${data.number}`);
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: workOrdersKey });
      qc.invalidateQueries({ queryKey: workOrderKey(v.id) });
    },
  });
}

export function useDeleteWorkOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("work_orders").delete().eq("id", id);
      if (error) throw error;
      await logAudit("work_order.delete", id, "Deleted work order");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workOrdersKey }),
  });
}

export function useBulkWorkOrderAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: "start" | "pause" | "resume" | "complete" }) => {
      const patch: Partial<WorkOrder> =
        action === "start" ? { status: "in_progress", started_at: new Date().toISOString() } :
        action === "pause" ? { status: "paused" } :
        action === "resume" ? { status: "in_progress" } :
        { status: "completed", completed_at: new Date().toISOString(), progress: 100 };
      const { error } = await supabase.from("work_orders").update(patch).in("id", ids);
      if (error) throw error;
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (uid) {
        await supabase.from("audit_log").insert(
          ids.map((id) => ({ action: `work_order.${action}`, entity: id, detail: `Bulk ${action}`, user_id: uid })),
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workOrdersKey }),
  });
}

/* ------------------------------ SOP Steps --------------------------- */
export const sopKey = (woId: string) => ["sop_steps", woId] as const;

export function useSopSteps(woId: string) {
  return useQuery({
    queryKey: sopKey(woId),
    queryFn: async () => {
      const { data, error } = await supabase.from("sop_steps").select("*").eq("work_order_id", woId).order("seq");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!woId,
  });
}

export function useUpdateSopStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch, woId }: { id: string; patch: Partial<SopStep>; woId: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      const finalPatch: Partial<SopStep> = { ...patch };
      if (patch.completed !== undefined) {
        finalPatch.completed_at = patch.completed ? new Date().toISOString() : null;
        finalPatch.completed_by = patch.completed ? uid ?? null : null;
      }
      const { data, error } = await supabase.from("sop_steps").update(finalPatch).eq("id", id).select().single();
      if (error) throw error;
      await logAudit("sop.update", woId, patch.completed !== undefined ? (patch.completed ? "Checked step" : "Unchecked step") : "Updated step");
      return data;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: sopKey(v.woId) }),
  });
}

export function useCreateSopStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SopStep> & { work_order_id: string; title: string; seq: number }) => {
      const { data, error } = await supabase.from("sop_steps").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => d && qc.invalidateQueries({ queryKey: sopKey(d.work_order_id) }),
  });
}

/* ----------------------- Inventory Transactions --------------------- */
export const inventoryKey = ["inventory_transactions"] as const;

export type InventoryTxnWithProduct = InventoryTxn & { product?: Pick<Product, "id" | "sku" | "name" | "uom"> | null };

export function useInventoryTxns() {
  return useQuery({
    queryKey: inventoryKey,
    queryFn: async (): Promise<InventoryTxnWithProduct[]> => {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("*, product:products(id,sku,name,uom)")
        .order("at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function useCreateInventoryTxn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<InventoryTxn> & { type: string; qty: number }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      const { data, error } = await supabase.from("inventory_transactions").insert({ ...input, user_id: uid }).select().single();
      if (error) throw error;
      await logAudit("inventory.txn", data.id, `${input.type} ${input.qty}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKey }),
  });
}

/* ------------------------------ Shipments --------------------------- */
export const shipmentsKey = ["shipments"] as const;

export function useShipments() {
  return useQuery({
    queryKey: shipmentsKey,
    queryFn: async (): Promise<ShipmentWithOrder[]> => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*, order:sales_orders(id,number,customer_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
}

export function useCreateShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Shipment> & { number: string }) => {
      const { data, error } = await supabase.from("shipments").insert(input).select().single();
      if (error) throw error;
      await logAudit("shipment.create", data.id, `Created ${data.number}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: shipmentsKey }),
  });
}

export function useUpdateShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Shipment> }) => {
      const { data, error } = await supabase.from("shipments").update(patch).eq("id", id).select().single();
      if (error) throw error;
      await logAudit("shipment.update", id, `Updated ${data.number}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: shipmentsKey }),
  });
}

export function useDeleteShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipments").delete().eq("id", id);
      if (error) throw error;
      await logAudit("shipment.delete", id, "Deleted shipment");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: shipmentsKey }),
  });
}

/* ------------------------- Seed helpers ---------------------------- */
export const orderStatusOptions = ["draft", "confirmed", "in_production", "partially_shipped", "shipped", "cancelled"];
export const workOrderStatusOptions = ["pending", "in_progress", "paused", "completed", "cancelled"];
export const shipmentStatusOptions = ["draft", "packed", "shipped", "delivered"];
export const inventoryTypeOptions = ["receipt", "issue", "transfer", "adjust"];
export const productTypeOptions = ["finished", "semi", "raw"];
