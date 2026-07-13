import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { Server, Database, Shield, Cpu, Cable, Save, Copy, Check } from "lucide-react";
import { useIntegrationSettings, useUpsertIntegrationSetting, type SisterSystem } from "@/lib/integrations-db";
import { sisterLabel } from "@/lib/integrations-client";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · CORTA OMS" }] }),
  component: SettingsPage,
});

const SYSTEMS: SisterSystem[] = ["mes", "qc"];

function SettingsPage() {
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

  const copy = (val: string, key: string) => {
    navigator.clipboard.writeText(val).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="System Settings" subtitle="Global configuration & sister-system integrations" />

      <Panel>
        <div className="mb-3 flex items-center gap-2">
          <Cable className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Sister-system integrations</h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Point this OMS at your <span className="text-foreground">MES</span> and <span className="text-foreground">CORTA QC System</span> deployments.
          Settings are stored per user. Sister systems can push events into the endpoints below.
        </p>

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
              <input
                disabled={!user}
                placeholder="https://your-mes.lovable.app"
                value={form[sys].base_url}
                onChange={(e) => setForm((f) => ({ ...f, [sys]: { ...f[sys], base_url: e.target.value } }))}
                className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-xs font-mono focus:border-primary/50 focus:outline-none"
              />
              <button
                disabled={!user || upsert.isPending}
                onClick={() => upsert.mutate({ system: sys, base_url: form[sys].base_url || null, enabled: form[sys].enabled })}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50">
                <Save className="h-3 w-3" /> Save
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Inbound webhook endpoints</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Configure your sister systems to POST events to these URLs. Include header <span className="font-mono">X-Webhook-Secret</span> matching the shared secret.
        </p>
        <div className="space-y-2">
          {[
            { label: "MES → OMS", path: "/api/public/webhooks/mes", hint: "station.heartbeat · downtime.started · downtime.ended" },
            { label: "QC → OMS", path: "/api/public/webhooks/qc", hint: "inspection.created · inspection.updated · ncr.raised · ncr.closed" },
          ].map((w) => {
            const full = `${webhookBase}${w.path}`;
            return (
              <div key={w.path} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold">{w.label}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{full}</div>
                  <div className="text-[10px] text-muted-foreground/70">{w.hint}</div>
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

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Outbound REST endpoints (this OMS exposes)</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Read-only JSON endpoints your sister systems can call to pull OMS data.
        </p>
        <div className="space-y-2">
          {[
            { label: "Sales orders", path: "/api/public/oms/orders", hint: "GET · ?status=&limit=" },
            { label: "Work orders", path: "/api/public/oms/work-orders", hint: "GET · ?status=&limit=" },
          ].map((e) => {
            const full = `${webhookBase}${e.path}`;
            return (
              <div key={e.path} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold">{e.label}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{full}</div>
                  <div className="text-[10px] text-muted-foreground/70">{e.hint}</div>
                </div>
                <button onClick={() => copy(full, e.path)}
                  className="flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[11px] hover:bg-card">
                  {copied === e.path ? <><Check className="h-3 w-3 text-success" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                </button>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Deployment</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Environment" value="production" mono />
            <Field label="API Version" value="v1.0.4" mono />
            <Field label="Runtime" value="Lovable Cloud" />
            <Field label="Region" value="edge" mono />
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Database</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Engine" value="PostgreSQL 15" />
            <Field label="RLS" value="Enabled" />
            <Field label="Realtime" value="Enabled" />
            <Field label="Backups" value="Automatic" />
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Authentication</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Providers" value="Email + Google" />
            <Field label="Session" value="JWT · autorefresh" mono />
            <Field label="Roles" value="admin / order_mgr / planner / supervisor / operator" />
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Observability</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audit log" value="Enabled" />
            <Field label="Integration feed" value="Enabled" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
