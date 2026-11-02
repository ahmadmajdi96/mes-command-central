import { mapHubPermissions, viewOnlyMatrix, type HubPermission, type Matrix } from "./access-hub-map";

export const HUB_SYSTEM_KEY = "mes-command-central";
const CACHE_MS = 5 * 60_000;

export type HubStatus = "not_configured" | "ok" | "inactive" | "rejected" | "unreachable";
export type HubResult = { status: HubStatus; message: string | null; roles: string[]; matrix: Matrix | null; fullName: string | null };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Ask the Command Access Hub what this person may do in MES Command Central. */
export async function fetchHub(email: string): Promise<HubResult> {
  const base = process.env["ACCESS_HUB_URL"];
  const key = process.env["ACCESS_HUB_API_KEY"];
  if (!base || !key) return { status: "not_configured", message: "Command Access Hub is not connected yet — local roles apply.", roles: [], matrix: null, fullName: null };
  try {
    const url = new URL("/api/public/v1/access", base);
    url.searchParams.set("email", email);
    const res = await fetch(url, { headers: { "x-api-key": key }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error("Access hub error", res.status);
      return { status: "rejected", message: "The Command Access Hub rejected this system's key — view only.", roles: [], matrix: viewOnlyMatrix(), fullName: null };
    }
    const body = (await res.json()) as { system?: string; active: boolean; roles: string[]; user: { full_name?: string } | null; permissions: HubPermission[] };
    if (body.system && body.system !== HUB_SYSTEM_KEY) console.warn(`Hub key belongs to "${body.system}", expected "${HUB_SYSTEM_KEY}"`);
    if (!body.active) return { status: "inactive", message: "Your account has no active role for this system in the Command Access Hub — view only.", roles: [], matrix: viewOnlyMatrix(), fullName: body.user?.full_name ?? null };
    return { status: "ok", message: null, roles: body.roles ?? [], matrix: mapHubPermissions(body.permissions ?? []), fullName: body.user?.full_name ?? null };
  } catch (e) {
    console.error("Access hub unreachable", e);
    return { status: "unreachable", message: "The Command Access Hub could not be reached — view only until it is back.", roles: [], matrix: viewOnlyMatrix(), fullName: null };
  }
}

/** Copy the Hub's answer into this app's permission tables so database rules enforce it. */
export async function syncUserFromHub(userId: string, email: string, force = false) {
  const db = await admin();
  const { data: existing } = await db.from("app_roles").select("id, hub_synced_at").eq("source", "hub").eq("hub_user_id", userId).maybeSingle();
  const { data: state } = await db.from("access_hub_state").select("*").eq("id", 1).single();
  if (!force && existing?.hub_synced_at && state?.enforced && Date.now() - new Date(existing.hub_synced_at).getTime() < CACHE_MS) {
    return { status: (state.last_status ?? "ok") as HubStatus, message: state.last_message as string | null, cached: true, roles: [] as string[] };
  }
  const r = await fetchHub(email);
  const enforced = r.status !== "not_configured";
  await db.from("access_hub_state").update({ enforced, last_status: r.status, last_message: r.message, last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", 1);
  if (!enforced || !r.matrix) return { status: r.status, message: r.message, cached: false, roles: r.roles };

  let roleId = existing?.id as string | undefined;
  const name = `Hub · ${email}`;
  const desc = r.roles.length ? `From Command Access Hub: ${r.roles.join(", ")}` : `From Command Access Hub (${r.status})`;
  if (!roleId) {
    const ins = await db.from("app_roles").insert({ name, description: desc, source: "hub", hub_user_id: userId, hub_synced_at: new Date().toISOString() }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    roleId = ins.data.id;
  } else {
    await db.from("app_roles").update({ name, description: desc, hub_synced_at: new Date().toISOString() }).eq("id", roleId);
  }
  await db.from("app_role_permissions").delete().eq("role_id", roleId);
  const rows = Object.entries(r.matrix).map(([resource, a]) => ({ role_id: roleId, resource, can_read: a.read, can_create: a.create, can_update: a.update, can_delete: a.delete }));
  if (rows.length) await db.from("app_role_permissions").insert(rows);
  const { data: link } = await db.from("user_app_roles").select("id").eq("user_id", userId).eq("role_id", roleId).maybeSingle();
  if (!link) await db.from("user_app_roles").insert({ user_id: userId, role_id: roleId });
  return { status: r.status, message: r.message, cached: false, roles: r.roles };
}

/** Effective permissions for the browser, computed the same way the database does. */
export async function effectiveAccess(userId: string) {
  const db = await admin();
  const { data: state } = await db.from("access_hub_state").select("*").eq("id", 1).single();
  const enforced = !!state?.enforced;
  const { data: isAdmin } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: links } = await db.from("user_app_roles").select("role_id, app_roles!inner(source)").eq("user_id", userId);
  const roleIds = ((links ?? []) as any[]).filter((l) => !enforced || l.app_roles?.source === "hub").map((l) => l.role_id);
  const matrix: Matrix = {};
  if (roleIds.length) {
    const { data: perms } = await db.from("app_role_permissions").select("resource, can_read, can_create, can_update, can_delete").in("role_id", roleIds);
    for (const p of perms ?? []) {
      const c = matrix[p.resource] ?? { read: false, create: false, update: false, delete: false };
      matrix[p.resource] = { read: c.read || p.can_read, create: c.create || p.can_create, update: c.update || p.can_update, delete: c.delete || p.can_delete };
    }
  }
  return {
    isAdmin: enforced ? false : !!isAdmin,
    hasRoles: roleIds.length > 0,
    matrix,
    hub: { enforced, status: (state?.last_status ?? "not_configured") as HubStatus, message: (state?.last_message ?? null) as string | null, checkedAt: state?.last_checked_at ?? null },
  };
}
