import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "./oms-db";

const T = (name: string) => supabase.from(name as never);
const rpc = (fn: string, args: Record<string, unknown>) => (supabase.rpc as any)(fn, args);

export interface Location { id: string; code: string; name: string; type: string; address: string | null; priority: number; active: boolean; source_system: string | null; created_at: string }
export interface InventoryLevel { id: string; product_id: string; location_id: string; on_hand: number; reserved: number; available: number; status: string; source_system: string; last_updated: string }
export interface Movement { id: string; product_id: string; location_id: string; to_location_id: string | null; type: string; qty: number; reference: string | null; at: string }
export interface Supply { id: string; product_id: string; location_id: string | null; source_type: string; reference: string | null; qty: number; expected_date: string | null; status: string; created_at: string }
export interface Reservation { id: string; order_line_id: string; order_id: string | null; product_id: string; location_id: string; qty: number; status: string; expires_at: string | null; created_at: string }
export interface Allocation { id: string; order_line_id: string; order_id: string | null; product_id: string; location_id: string; qty: number; status: string; created_at: string }
export interface SupplyDemand { product_id: string; sku: string; name: string; on_hand: number; reserved: number; demand: number; incoming: number }
export interface Availability { requested: number; available: number; incoming: number; atp: number; supply_date: string | null; status: "available" | "atp" | "short" }

export const invKey = ["inventory"] as const;

function list<R>(key: string, table: string, order = "created_at", filter?: (q: any) => any) {
  return () => useQuery({
    queryKey: [...invKey, key],
    queryFn: async (): Promise<R[]> => {
      let q = T(table).select("*").order(order, { ascending: false }).limit(2000);
      if (filter) q = filter(q);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as R[];
    },
  });
}

export const useLocations = list<Location>("locations", "locations");
export const useInventoryLevels = list<InventoryLevel>("levels", "inventory_levels", "last_updated");
export const useMovements = list<Movement>("movements", "inventory_movements", "at");
export const useSupply = list<Supply>("supply", "supply");
export const useReservations = list<Reservation>("reservations", "reservations");
export const useAllocations = list<Allocation>("allocations", "allocations");
export const useSupplyDemand = list<SupplyDemand>("sd", "v_supply_demand", "sku");

export function useOrderReservations(orderId: string) {
  return useQuery({
    queryKey: [...invKey, "order", orderId],
    queryFn: async () => {
      const [r, a] = await Promise.all([
        T("reservations").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
        T("allocations").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
      ]);
      if (r.error) throw r.error;
      if (a.error) throw a.error;
      return { reservations: (r.data ?? []) as unknown as Reservation[], allocations: (a.data ?? []) as unknown as Allocation[] };
    },
  });
}

export async function checkAvailability(productId: string, qty: number): Promise<Availability> {
  const { data, error } = await rpc("check_availability", { _product: productId, _qty: qty });
  if (error) throw error;
  return data as Availability;
}

export function useAvailability(productId: string | undefined, qty: number) {
  return useQuery({
    queryKey: [...invKey, "avail", productId, qty],
    enabled: !!productId,
    queryFn: () => checkAvailability(productId!, qty || 0),
  });
}

function useInvMutation<V>(fn: (v: V) => Promise<unknown>, okMsg: string, audit?: (v: V) => [string, string, string?]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      const r = await fn(v);
      if (audit) { const [a, e, d] = audit(v); await logAudit(a, e, d); }
      return r;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: invKey }); toast.success(okMsg); },
    onError: (e: Error) => toast.error(e.message),
  });
}

const unwrap = async (p: PromiseLike<{ error: { message: string } | null; data?: unknown }>) => {
  const { error, data } = await p;
  if (error) throw new Error(error.message);
  return data;
};

export const useSaveLocation = () => useInvMutation(
  (v: Partial<Location>) => unwrap(v.id ? T("locations").update(v as never).eq("id", v.id) : T("locations").insert(v as never)),
  "Location saved", (v) => ["location.save", v.code ?? "location"]);
export const useDeleteLocation = () => useInvMutation((id: string) => unwrap(T("locations").delete().eq("id", id)), "Location deleted");

export const useMove = () => useInvMutation(
  (v: { product: string; location: string; type: string; qty: number; to?: string | null; reference?: string | null }) =>
    unwrap(rpc("inv_move", { _product: v.product, _location: v.location, _type: v.type, _qty: v.qty, _to_location: v.to ?? null, _reference: v.reference ?? null })),
  "Stock updated", (v) => ["inventory." + v.type, v.product, `${v.qty}`]);

export const useSetLevelStatus = () => useInvMutation(
  (v: { id: string; status: string }) => unwrap(T("inventory_levels").update({ status: v.status, last_updated: new Date().toISOString() } as never).eq("id", v.id)),
  "Status updated");

export const useSaveSupply = () => useInvMutation(
  (v: Partial<Supply>) => unwrap(v.id ? T("supply").update(v as never).eq("id", v.id) : T("supply").insert(v as never)),
  "Supply saved");
export const useDeleteSupply = () => useInvMutation((id: string) => unwrap(T("supply").delete().eq("id", id)), "Supply deleted");

export const useReserve = () => useInvMutation(
  (v: { line: string; location: string; qty: number; minutes?: number }) =>
    unwrap(rpc("reserve_stock", { _line: v.line, _location: v.location, _qty: v.qty, _minutes: v.minutes ?? 1440 })),
  "Stock reserved", (v) => ["reservation.create", v.line, `${v.qty}`]);
export const useRelease = () => useInvMutation((id: string) => unwrap(rpc("release_reservation", { _id: id, _status: "released" })), "Reservation released");
export const useExpire = () => useInvMutation(() => unwrap(rpc("expire_reservations", {})), "Expired reservations released");

export const useAllocate = () => useInvMutation(
  (v: { line: string; location: string; qty: number }) => unwrap(rpc("allocate_line", { _line: v.line, _location: v.location, _qty: v.qty })),
  "Stock allocated", (v) => ["allocation.create", v.line, `${v.qty}`]);
export const useDeallocate = () => useInvMutation((id: string) => unwrap(rpc("deallocate", { _id: id })), "Allocation removed");

/** Reallocate: remove existing allocation then allocate same qty at a new location. */
export const useReallocate = () => useInvMutation(async (v: { allocation: Allocation; location: string }) => {
  await unwrap(rpc("deallocate", { _id: v.allocation.id }));
  await unwrap(rpc("allocate_line", { _line: v.allocation.order_line_id, _location: v.location, _qty: v.allocation.qty }));
}, "Stock reallocated");
