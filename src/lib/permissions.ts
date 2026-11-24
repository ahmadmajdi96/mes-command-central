import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export type Resource =
  | "orders" | "customers" | "products" | "shipments"
  | "production_orders" | "batches" | "requests" | "feedback"
  | "audit" | "settings" | "users" | "roles" | "inventory" | "locations" | "rules" | "workflow" | "orchestration" | "fulfillments" | "exceptions" | "alerts" | "kpis" | "integrations";

export type Action = "read" | "create" | "update" | "delete";

export const RESOURCES: Resource[] = [
  "orders", "customers", "products", "shipments",
  "production_orders", "batches", "requests", "feedback",
  "audit", "settings", "users", "roles", "inventory", "locations", "rules", "workflow", "orchestration", "fulfillments", "exceptions", "alerts", "kpis", "integrations",
];

export const ACTIONS: Action[] = ["read", "create", "update", "delete"];

interface Perm {
  isAdmin: boolean;
  hasRoles: boolean;
  matrix: Record<string, Record<Action, boolean>>;
}

export function usePermissions() {
  const { user, roles } = useSession();
  return useQuery({
    queryKey: ["permissions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Perm> => {
      if (!user) return { isAdmin: false, hasRoles: false, matrix: {} };
      const isAdmin = roles.includes("admin");
      const { data: assignments } = await supabase
        .from("user_app_roles" as never)
        .select("role_id")
        .eq("user_id", user.id);
      const roleIds = (assignments ?? []).map((r: { role_id: string }) => r.role_id);
      if (roleIds.length === 0) return { isAdmin, hasRoles: false, matrix: {} };
      const { data: perms } = await supabase
        .from("app_role_permissions" as never)
        .select("resource, can_read, can_create, can_update, can_delete")
        .in("role_id", roleIds);
      const matrix: Perm["matrix"] = {};
      for (const p of (perms ?? []) as Array<{ resource: string; can_read: boolean; can_create: boolean; can_update: boolean; can_delete: boolean }>) {
        const cur = matrix[p.resource] ?? { read: false, create: false, update: false, delete: false };
        matrix[p.resource] = {
          read: cur.read || p.can_read,
          create: cur.create || p.can_create,
          update: cur.update || p.can_update,
          delete: cur.delete || p.can_delete,
        };
      }
      return { isAdmin, hasRoles: true, matrix };
    },
    staleTime: 60_000,
  });
}

export function getOperationAccess(grants: Record<Action, boolean> | undefined) {
  const read = grants?.read === true;
  const update = grants?.update === true;
  // The released INSERT policy accepts create or update. Writes that return rows also need SELECT.
  return { create: read && (grants.create || update), update: read && update, delete: read && grants.delete };
}

export function describeWriteError(error: unknown, action: string) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "42501") {
    return `You don’t have permission to ${action}. Contact your OMS administrator.`;
  }
  return `Could not ${action}. Try again.`;
}

export function useOperationAccess(resource: "orders" | "shipments") {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["operation-access", user?.id, resource],
    enabled: !!user,
    queryFn: async (): Promise<Record<Action, boolean>> => {
      const resources = resource === "orders" ? ["orders"] : ["shipments", "fulfillments"];
      const checks = await Promise.all(ACTIONS.map(async (action) => {
        const { data, error } = await supabase.rpc("app_can_any", { _res: resources, _act: action });
        if (error) throw error;
        return [action, data === true] as const;
      }));
      return Object.fromEntries(checks) as Record<Action, boolean>;
    },
  });
  return {
    ...getOperationAccess(query.isSuccess ? query.data : undefined),
    pending: query.isPending,
    failed: query.isError,
  };
}

export function usePermission(resource: Resource, action: Action): boolean {
  const { data } = usePermissions();
  if (!data) return true; // permissive while loading to avoid UI flicker
  if (data.isAdmin) return true;
  // Users without any role can look but not change anything; users with roles get exactly what their roles grant.
  if (!data.hasRoles) return action === "read";
  return data.matrix[resource]?.[action] ?? false;
}
