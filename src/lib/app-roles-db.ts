import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Action, Resource } from "./permissions";

export interface AppRole {
  id: string;
  name: string;
  description: string | null;
}

export interface AppRolePermission {
  id: string;
  role_id: string;
  resource: Resource;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export function useAppRoles() {
  return useQuery({
    queryKey: ["app_roles"],
    queryFn: async (): Promise<AppRole[]> => {
      const { data, error } = await supabase.from("app_roles").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRolePermissions(roleId: string | null) {
  return useQuery({
    queryKey: ["app_role_permissions", roleId],
    enabled: !!roleId,
    queryFn: async (): Promise<AppRolePermission[]> => {
      const { data, error } = await supabase.from("app_role_permissions").select("*").eq("role_id", roleId!);
      if (error) throw error;
      return (data ?? []) as AppRolePermission[];
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const { data, error } = await supabase.from("app_roles").insert(input as never).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app_roles"] }); toast.success("Role created"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("app_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["app_roles"] }); toast.success("Role deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpsertPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { role_id: string; resource: Resource; action: Action; value: boolean }) => {
      const column = `can_${input.action}` as const;
      const { data: existing } = await supabase
        .from("app_role_permissions").select("id")
        .eq("role_id", input.role_id).eq("resource", input.resource).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("app_role_permissions").update({ [column]: input.value } as never).eq("id", existing.id);
        if (error) throw error;
      } else {
        const row = { role_id: input.role_id, resource: input.resource, can_read: false, can_create: false, can_update: false, can_delete: false, [column]: input.value };
        const { error } = await supabase.from("app_role_permissions").insert(row as never);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["app_role_permissions", v.role_id] });
      qc.invalidateQueries({ queryKey: ["permissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
