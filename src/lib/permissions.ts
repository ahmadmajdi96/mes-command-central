import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export type Resource =
  | "orders" | "customers" | "products" | "shipments"
  | "production_orders" | "batches" | "requests" | "feedback"
  | "audit" | "settings" | "users" | "roles";

export type Action = "read" | "create" | "update" | "delete";

export const RESOURCES: Resource[] = [
  "orders", "customers", "products", "shipments",
  "production_orders", "batches", "requests", "feedback",
  "audit", "settings", "users", "roles",
];

export const ACTIONS: Action[] = ["read", "create", "update", "delete"];

interface Perm {
  isAdmin: boolean;
  matrix: Record<string, Record<Action, boolean>>;
}

export function usePermissions() {
  const { user, roles } = useSession();
  return useQuery({
    queryKey: ["permissions", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Perm> => {
      if (!user) return { isAdmin: false, matrix: {} };
      const isAdmin = roles.includes("admin");
      const { data: assignments } = await supabase
        .from("user_app_roles" as never)
        .select("role_id")
        .eq("user_id", user.id);
      const roleIds = (assignments ?? []).map((r: { role_id: string }) => r.role_id);
      if (roleIds.length === 0) return { isAdmin, matrix: {} };
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
      return { isAdmin, matrix };
    },
    staleTime: 60_000,
  });
}

export function usePermission(resource: Resource, action: Action): boolean {
  const { data } = usePermissions();
  if (!data) return true; // permissive while loading to avoid UI flicker
  if (data.isAdmin) return true;
  return data.matrix[resource]?.[action] ?? true; // default permissive — users with no assigned roles keep full access until roles are configured
}
