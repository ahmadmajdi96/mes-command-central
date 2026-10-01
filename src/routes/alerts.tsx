import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Play } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { FormDialog } from "@/components/form-dialog";
import { ALERT_METRICS, EXC_SEVERITIES, useAlertRules, useDeleteAlertRule, useRunAlerts, useSaveAlertRule, type AlertRule } from "@/lib/exceptions-db";

export const Route = createFileRoute("/alerts")({
  head: () => ({ meta: [
    { title: "Alert Rules · OMS" },
    { name: "description", content: "Set limits on delays, holds, failures and backorders; crossing a limit sends a notification." },
    { property: "og:title", content: "Alert Rules · OMS" },
    { property: "og:description", content: "Set limits on delays, holds, failures and backorders; crossing a limit sends a notification." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AlertsPage,
});

function AlertsPage() {
  const { data: rows = [], isLoading } = useAlertRules();
  const save = useSaveAlertRule(); const del = useDeleteAlertRule(); const run = useRunAlerts();
  const [edit, setEdit] = useState<Partial<AlertRule> | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader title="Alert Rules" subtitle={isLoading ? "Loading…" : `${rows.filter((r) => r.enabled).length} active · a rule fires when the count is above its limit`}
        actions={<>
          <button onClick={() => run.mutate(undefined)} className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning"><Play className="h-3.5 w-3.5" /> Check now</button>
          <button onClick={() => setEdit({})} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary"><Plus className="h-3.5 w-3.5" /> New rule</button>
        </>} />
      <DataTable<AlertRule> rows={rows} empty="No alert rules yet — add one, e.g. 'More than 0 failed fulfillments'" columns={[
        { key: "name", label: "Rule", render: (r) => <span className="text-xs font-medium">{r.name}</span> },
        { key: "metric", label: "Watches", render: (r) => <span className="text-xs">{ALERT_METRICS[r.metric] ?? r.metric}</span> },
        { key: "t", label: "Limit", align: "right", render: (r) => <span className="font-mono text-xs">&gt; {Number(r.threshold)}</span> },
        { key: "c", label: "Last count", align: "right", render: (r) => <span className={`font-mono text-xs ${r.last_count != null && r.last_count > r.threshold ? "text-destructive" : ""}`}>{r.last_count ?? "—"}</span> },
        { key: "s", label: "Severity", render: (r) => <span className="text-xs capitalize">{r.severity}{r.create_exception ? " · raises exception" : ""}</span> },
        { key: "f", label: "Last fired", render: (r) => <span className="text-xs text-muted-foreground">{r.last_fired_at ? new Date(r.last_fired_at).toLocaleString() : "never"}</span> },
        { key: "e", label: "Active", render: (r) => <input type="checkbox" checked={r.enabled} onChange={(e) => save.mutate({ id: r.id, enabled: e.target.checked })} /> },
        { key: "a", label: "", align: "right", render: (r) => <span className="flex justify-end gap-2 text-xs"><button className="text-primary hover:underline" onClick={() => setEdit(r)}>Edit</button><button className="text-destructive hover:underline" onClick={() => confirm(`Delete "${r.name}"?`) && del.mutate(r.id)}>Delete</button></span> },
      ]} />
      <FormDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)} title={edit?.id ? "Edit alert rule" : "New alert rule"}
        description="Alerts appear in Notifications for everyone. Optionally they also raise an exception."
        initial={edit ? { ...edit, create_exception: edit.create_exception ? "yes" : "no" } as any : undefined}
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "metric", label: "Watch", type: "select", required: true, options: Object.entries(ALERT_METRICS).map(([value, label]) => ({ value, label })) },
          { name: "threshold", label: "Fire when count is above", type: "number", required: true },
          { name: "severity", label: "Severity", type: "select", options: EXC_SEVERITIES.map((s) => ({ value: s, label: s })) },
          { name: "create_exception", label: "Also raise an exception", type: "select", options: [{ value: "no", label: "No" }, { value: "yes", label: "Yes" }] },
        ]}
        onSubmit={async (v: any) => {
          if (Number(v.threshold) < 0) throw new Error("Limit cannot be negative");
          await save.mutateAsync({ ...(edit?.id ? { id: edit.id } : {}), name: v.name, metric: v.metric, threshold: Number(v.threshold), severity: v.severity || "medium", create_exception: v.create_exception === "yes" });
        }} />
    </div>
  );
}
