import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(ctx: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: admin only");
}

function randomPassword() {
  return "Tmp-" + Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authRes, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    const users = authRes.users ?? [];
    const ids = users.map((u) => u.id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, display_name, email, must_reset_password").in("id", ids);
    const { data: appRoles } = await supabaseAdmin
      .from("user_app_roles").select("user_id, role_id").in("user_id", ids);
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      display_name: profileMap.get(u.id)?.display_name ?? null,
      must_reset_password: profileMap.get(u.id)?.must_reset_password ?? false,
      role_ids: (appRoles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role_id),
    }));
  });

export const createUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; displayName?: string; roleIds?: string[] }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tempPassword = randomPassword();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name: data.displayName || data.email },
    });
    if (error) throw error;
    const uid = created.user!.id;
    await supabaseAdmin.from("profiles").upsert({
      id: uid, email: data.email, display_name: data.displayName || data.email, must_reset_password: true,
    } as never);
    if (data.roleIds && data.roleIds.length) {
      await supabaseAdmin.from("user_app_roles").insert(
        data.roleIds.map((role_id) => ({ user_id: uid, role_id })) as never
      );
    }
    // Generate a magic link the admin can share (one-time login)
    const { data: linkRes } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: data.email });
    return {
      id: uid,
      email: data.email,
      temp_password: tempPassword,
      one_time_link: linkRes?.properties?.action_link ?? null,
    };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; email: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tempPassword = randomPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: tempPassword });
    if (error) throw error;
    await supabaseAdmin.from("profiles").update({ must_reset_password: true } as never).eq("id", data.userId);
    const { data: linkRes } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: data.email });
    return { temp_password: tempPassword, one_time_link: linkRes?.properties?.action_link ?? null };
  });

export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; roleIds: string[] }) => data)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_app_roles").delete().eq("user_id", data.userId);
    if (data.roleIds.length) {
      await supabaseAdmin.from("user_app_roles").insert(
        data.roleIds.map((role_id) => ({ user_id: data.userId, role_id })) as never
      );
    }
    return { ok: true };
  });
