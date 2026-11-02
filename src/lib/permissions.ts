import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/hooks/use-session";
import { getMyAccess } from "@/lib/access-hub.functions";

export type Resource =
  | "orders" | "customers" | "products" | "shipments"
  | "production_orders" | "batches" | "requests" | "feedback"
  | "audit" | "settings" | "users" | "roles" | "inventory" | "locations" | "rules" | "workflow" | "orchestration" | "fulfillments" | "exceptions" | "alerts" | "kpis" | "integrations"
  | "quality_holds" | "ncr" | "capa";

export type Action = "read" | "create" | "update" | "delete";

export const RESOURCES: Resource[] = [
  "orders", "customers", "products", "shipments",
  "production_orders", "batches", "requests", "feedback",
  "audit", "settings", "users", "roles", "inventory", "locations", "rules", "workflow", "orchestration", "fulfillments", "exceptions", "alerts", "kpis", "integrations",
  "quality_holds", "ncr", "capa",
];

export const ACTIONS: Action[] = ["read", "create", "update", "delete"];

export interface Perm {
  isAdmin: boolean;
  hasRoles: boolean;
  matrix: Record<string, Record<Action, boolean>>;
  hub: { enforced: boolean; status: string; message: string | null; checkedAt: string | null };
}

/** Effective access. When the Command Access Hub is connected it is the only source of rights. */
export function usePermissions() {
  const { user } = useSession();
  const fetchAccess = useServerFn(getMyAccess);
  return useQuery({
    queryKey: ["permissions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Perm> => (await fetchAccess({ data: {} })) as Perm,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function usePermission(resource: Resource, action: Action): boolean {
  const { data } = usePermissions();
  if (!data) return true; // permissive while loading to avoid UI flicker; the database still enforces
  if (data.isAdmin) return true;
  if (!data.hasRoles) return action === "read";
  return data.matrix[resource]?.[action] ?? false;
}
