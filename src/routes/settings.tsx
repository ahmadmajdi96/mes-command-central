import { useState, useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { Server, Database, Shield, Cpu, Cable, Save, Copy, Check, Users, KeyRound, Plus, Trash2, RotateCcw, ClipboardCopy } from "lucide-react";
import { useIntegrationSettings, useUpsertIntegrationSetting, type SisterSystem } from "@/lib/integrations-db";
import { sisterLabel } from "@/lib/integrations-client";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUsers, createUserAdmin, resetUserPassword, deleteUserAdmin, setUserRoles } from "@/lib/admin-users.functions";
import { useAppRoles, useCreateRole, useDeleteRole, useRolePermissions, useUpsertPermission } from "@/lib/app-roles-db";
import { RESOURCES, ACTIONS, type Resource, type Action } from "@/lib/permissions";
import { ConfirmDialog } from "@/components/confirm-dialog";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · CORTA OMS" }] }),
  component: SettingsPage,
});

type Tab = "integrations" | "users" | "roles";

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("integrations");
  return (
    <div className="space-y-5">
      <PageHeader title="System Settings" subtitle="Global configuration, users, and roles" />
      <div className="flex items-center gap-1 border-b border-border/60">
        {(["integrations", "users", "roles"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium capitalize border-b-2 -mb-px ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t === "users" && <Users className="h-3.5 w-3.5" />}
            {t === "roles" && <KeyRound className="h-3.5 w-3.5" />}
            {t === "integrations" && <Cable className="h-3.5 w-3.5" />}
            {t}
          </button>
        ))}
      </div>
      {tab === "integrations" && <IntegrationsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "roles" && <RolesTab />}
    </div>
  );
}

/* -------------- USERS TAB -------------- */
function UsersTab() {
  const qc = useQueryClient();
  const list = useServerFn(listUsers);
  const create = useServerFn(createUserAdmin);
  const reset = useServerFn(resetUserPassword);
  const del = useServerFn(deleteUserAdmin);
  const setRoles = useServerFn(setUserRoles);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: () => list(),
  });
  const { data: roles = [] } = useAppRoles();

  const [showNew, setShowNew] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [lastCred, setLastCred] = useState<{ email: string; temp_password: string; one_time_link: string | null } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await create({ data: { email, displayName: name, roleIds: selectedRoles } });
      return { ...res, email };
    },
    onSuccess: (res) => {
      setLastCred({ email: res.email, temp_password: res.temp_password, one_time_link: res.one_time_link });
      setShowNew(false); setEmail(""); setName(""); setSelectedRoles([]);
      qc.invalidateQueries({ queryKey: ["admin_users"] });
      toast.success("User created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: async (u: { id: string; email: string }) => reset({ data: { userId: u.id, email: u.email } }).then((r) => ({ ...r, email: u.email })),
    onSuccess: (res) => { setLastCred({ email: res.email, temp_password: res.temp_password, one_time_link: res.one_time_link }); qc.invalidateQueries({ queryKey: ["admin_users"] }); toast.success("Password reset"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => del({ data: { userId: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_users"] }); toast.success("User deleted"); setConfirmDel(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rolesMut = useMutation({
    mutationFn: async ({ userId, roleIds }: { userId: string; roleIds: string[] }) => setRoles({ data: { userId, roleIds } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_users"] }); toast.success("Roles updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Users</h3>
            <p className="text-[11px] text-muted-foreground">Admins can create users and assign roles.</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20">
            <Plus className="h-3.5 w-3.5" /> Add user
          </button>
        </div>

        {lastCred && (
          <div className="mb-3 rounded-xl border border-success/40 bg-success/5 p-3 text-xs">
            <div className="font-semibold text-success">Credentials for {lastCred.email}</div>
            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-2"><span className="text-muted-foreground">Temp password:</span>
                <code className="rounded bg-card px-2 py-0.5 font-mono">{lastCred.temp_password}</code>
                <button onClick={() => { navigator.clipboard.writeText(lastCred.temp_password); toast.success("Copied"); }}>
                  <ClipboardCopy className="h-3 w-3" />
                </button>
              </div>
              {lastCred.one_time_link && (
                <div className="flex items-center gap-2"><span className="text-muted-foreground">One-time link:</span>
                  <code className="max-w-[420px] truncate rounded bg-card px-2 py-0.5 font-mono">{lastCred.one_time_link}</code>
                  <button onClick={() => { navigator.clipboard.writeText(lastCred.one_time_link!); toast.success("Copied"); }}>
                    <ClipboardCopy className="h-3 w-3" />
                  </button>
                </div>
              )}
              <p className="mt-1 text-muted-foreground">Share this with the user — they will be forced to set a new password on first login.</p>
              <button onClick={() => setLastCred(null)} className="mt-2 text-primary hover:underline">Dismiss</button>
            </div>
          </div>
        )}

        {isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Roles</th>
                  <th className="pb-2 font-medium">Last sign-in</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRow key={u.id} user={u} roles={roles}
                    onReset={() => resetMut.mutate({ id: u.id, email: u.email })}
                    onDelete={() => setConfirmDel(u.id)}
                    onRolesChange={(ids) => rolesMut.mutate({ userId: u.id, roleIds: ids })} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowNew(false)}>
          <div className="glass-panel w-full max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold">New user</h3>
            <div className="space-y-3">
              <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm" />
              <input placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm" />
              <div>
                <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Roles</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {roles.length === 0 && <span className="text-[11px] text-muted-foreground">No roles yet — create one in the Roles tab.</span>}
                  {roles.map((r) => {
                    const active = selectedRoles.includes(r.id);
                    return (
                      <button key={r.id} onClick={() => setSelectedRoles((s) => active ? s.filter((x) => x !== r.id) : [...s, r.id])}
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${active ? "border-primary/40 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground"}`}>
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowNew(false)} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs">Cancel</button>
                <button onClick={() => createMut.mutate()} disabled={!email || createMut.isPending}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">Create user</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Delete user?" description="This permanently removes the account."
        variant="destructive"
        onConfirm={() => confirmDel && delMut.mutate(confirmDel)} />
    </div>
  );
}

function UserRow({ user, roles, onReset, onDelete, onRolesChange }: {
  user: { id: string; email: string; display_name: string | null; last_sign_in_at: string | null; must_reset_password: boolean; role_ids: string[] };
  roles: Array<{ id: string; name: string }>;
  onReset: () => void; onDelete: () => void; onRolesChange: (ids: string[]) => void;
}) {
  const [editRoles, setEditRoles] = useState(false);
  const [selected, setSelected] = useState<string[]>(user.role_ids);
  useEffect(() => setSelected(user.role_ids), [user.role_ids]);
  return (
    <tr className="border-b border-border/30">
      <td className="py-2 text-xs">{user.email}</td>
      <td className="py-2 text-xs">{user.display_name ?? "—"}</td>
      <td className="py-2 text-xs">
        {editRoles ? (
          <div className="flex flex-wrap items-center gap-1">
            {roles.map((r) => {
              const active = selected.includes(r.id);
              return (
                <button key={r.id} onClick={() => setSelected((s) => active ? s.filter((x) => x !== r.id) : [...s, r.id])}
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${active ? "border-primary/40 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground"}`}>
                  {r.name}
                </button>
              );
            })}
            <button onClick={() => { onRolesChange(selected); setEditRoles(false); }} className="ml-1 rounded border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success">Save</button>
            <button onClick={() => { setSelected(user.role_ids); setEditRoles(false); }} className="rounded border border-border/60 px-2 py-0.5 text-[10px]">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditRoles(true)} className="flex flex-wrap gap-1 text-left">
            {user.role_ids.length === 0 && <span className="text-muted-foreground">—</span>}
            {user.role_ids.map((rid) => {
              const r = roles.find((x) => x.id === rid);
              return r ? <span key={rid} className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px]">{r.name}</span> : null;
            })}
          </button>
        )}
      </td>
      <td className="py-2 text-xs text-muted-foreground">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—"}</td>
      <td className="py-2 text-right">
        <div className="inline-flex gap-1">
          <button onClick={onReset} className="rounded-md border border-border/60 px-2 py-1 text-[10px] hover:text-primary inline-flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Reset password</button>
          <button onClick={onDelete} className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive"><Trash2 className="h-3 w-3" /></button>
        </div>
      </td>
    </tr>
  );
}

/* -------------- ROLES TAB -------------- */
function RolesTab() {
  const { data: roles = [] } = useAppRoles();
  const create = useCreateRole();
  const del = useDeleteRole();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (!selectedRole && roles.length > 0) setSelectedRole(roles[0].id);
  }, [roles, selectedRole]);

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Roles</h3>
          <button onClick={() => setShowNew(true)} className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] text-primary">
            <Plus className="inline h-3 w-3" /> New
          </button>
        </div>
        <div className="space-y-1">
          {roles.length === 0 && <p className="text-[11px] text-muted-foreground">No roles yet.</p>}
          {roles.map((r) => (
            <div key={r.id} className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs ${selectedRole === r.id ? "bg-primary/15 text-primary" : "hover:bg-card/60"}`}>
              <button onClick={() => setSelectedRole(r.id)} className="flex-1 truncate text-left">{r.name}</button>
              <button onClick={() => { if (confirm(`Delete role "${r.name}"?`)) del.mutate(r.id); }}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
        {showNew && (
          <div className="mt-3 space-y-2 rounded-lg border border-border/60 p-2">
            <input placeholder="Role name" value={name} onChange={(e) => setName(e.target.value)}
              className="h-8 w-full rounded border border-border/60 bg-card/60 px-2 text-xs" />
            <input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)}
              className="h-8 w-full rounded border border-border/60 bg-card/60 px-2 text-xs" />
            <div className="flex gap-1">
              <button onClick={async () => { if (!name.trim()) return; await create.mutateAsync({ name: name.trim(), description: desc.trim() || undefined }); setName(""); setDesc(""); setShowNew(false); }}
                className="flex-1 rounded bg-primary py-1 text-[10px] text-primary-foreground">Create</button>
              <button onClick={() => setShowNew(false)} className="rounded border border-border/60 px-2 text-[10px]">Cancel</button>
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Permissions {selectedRole && <span className="text-[11px] font-normal text-muted-foreground">— {roles.find((r) => r.id === selectedRole)?.name}</span>}</h3>
        {selectedRole ? <PermissionsMatrix roleId={selectedRole} /> : <p className="text-xs text-muted-foreground">Select a role to configure permissions.</p>}
      </Panel>
    </div>
  );
}

function PermissionsMatrix({ roleId }: { roleId: string }) {
  const { data: perms = [] } = useRolePermissions(roleId);
  const upsert = useUpsertPermission();
  const map = useMemo(() => {
    const m = new Map<string, { read: boolean; create: boolean; update: boolean; delete: boolean }>();
    for (const p of perms) m.set(p.resource, { read: p.can_read, create: p.can_create, update: p.can_update, delete: p.can_delete });
    return m;
  }, [perms]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 font-medium">Resource</th>
            {ACTIONS.map((a) => <th key={a} className="pb-2 text-center font-medium">{a}</th>)}
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((res) => {
            const row = map.get(res) ?? { read: false, create: false, update: false, delete: false };
            return (
              <tr key={res} className="border-b border-border/30">
                <td className="py-2 text-xs capitalize">{res.replace("_", " ")}</td>
                {ACTIONS.map((a) => (
                  <td key={a} className="py-2 text-center">
                    <input type="checkbox" checked={row[a as Action]}
                      onChange={(e) => upsert.mutate({ role_id: roleId, resource: res as Resource, action: a, value: e.target.checked })} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------- INTEGRATIONS TAB (existing content) -------------- */
const SYSTEMS: SisterSystem[] = ["mes", "qc"];
function IntegrationsTab() {
  const { user } = useSession();
  const { data: settings = [] } = useIntegrationSettings();
  const upsert = useUpsertIntegrationSetting();
  const [form, setForm] = useState<Record<SisterSystem, { base_url: string; enabled: boolean }>>({
    mes: { base_url: "", enabled: false },
    qc: { base_url: "", enabled: false },
    command_center: { base_url: "", enabled: false },
  });
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const next = { ...form };
    for (const s of SYSTEMS) {
      const row = settings.find((r) => r.system === s);
      if (row) next[s] = { base_url: row.base_url ?? "", enabled: row.enabled };
    }
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const webhookBase = typeof window !== "undefined" ? window.location.origin : "";
  const copy = (val: string, key: string) => { navigator.clipboard.writeText(val).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1500); }); };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-3 flex items-center gap-2">
          <Cable className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Sister-system integrations</h3>
        </div>
        {!user && <p className="mb-3 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-warning">Sign in to configure integrations.</p>}
        <div className="grid gap-3 lg:grid-cols-3">
          {SYSTEMS.map((sys) => (
            <div key={sys} className="rounded-xl border border-border/60 bg-card/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">{sisterLabel(sys)}</div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" className="peer sr-only" disabled={!user}
                    checked={form[sys].enabled}
                    onChange={(e) => setForm((f) => ({ ...f, [sys]: { ...f[sys], enabled: e.target.checked } }))} />
                  <div className="peer h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors">
                    <div className="h-5 w-5 rounded-full bg-background border border-border shadow-sm transition-transform peer-checked:translate-x-4" />
                  </div>
                </label>
              </div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Base URL</label>
              <input disabled={!user} placeholder="https://your-mes.lovable.app"
                value={form[sys].base_url}
                onChange={(e) => setForm((f) => ({ ...f, [sys]: { ...f[sys], base_url: e.target.value } }))}
                className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs font-mono" />
              <button disabled={!user || upsert.isPending}
                onClick={() => upsert.mutate({ system: sys, base_url: form[sys].base_url || null, enabled: form[sys].enabled })}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50">
                <Save className="h-3 w-3" /> Save
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Webhook endpoints</h3>
        <div className="space-y-2">
          {[
            { label: "MES → OMS", path: "/api/public/webhooks/mes" },
            { label: "QC → OMS", path: "/api/public/webhooks/qc" },
          ].map((w) => {
            const full = `${webhookBase}${w.path}`;
            return (
              <div key={w.path} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold">{w.label}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{full}</div>
                </div>
                <button onClick={() => copy(full, w.path)}
                  className="flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[11px] hover:bg-card">
                  {copied === w.path ? <><Check className="h-3 w-3 text-success" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center gap-2"><Server className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Deployment</h3></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Environment" value="production" mono />
            <Field label="Runtime" value="Lovable Cloud" />
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center gap-2"><Database className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Database</h3></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="RLS" value="Enabled" />
            <Field label="Realtime" value="Enabled" />
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Authentication</h3></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Session" value="JWT · autorefresh" mono />
            <Field label="Roles" value="Dynamic (see Roles tab)" />
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Observability</h3></div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audit log" value="Enabled" />
            <Field label="Integration feed" value="Enabled" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
