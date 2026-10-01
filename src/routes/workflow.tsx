import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader, Panel } from "@/components/page-shell";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { orchKey, useTransitions, useSaveTransition, useDeleteTransition, ORDER_STATUSES } from "@/lib/orchestration-db";

export const Route = createFileRoute("/workflow")({
  head: () => ({ meta: [
    { title: "Order Workflow · OMS" },
    { name: "description", content: "Define which order status changes are allowed and their time limits." },
    { property: "og:title", content: "Order Workflow · OMS" },
    { property: "og:description", content: "Define which order status changes are allowed and their time limits." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: WorkflowPage,
});

const label = (s: string) => s.replace(/_/g, " ");

function WorkflowPage() {
  useRealtimeInvalidate("workflow_transitions" as never, [orchKey]);
  const { data: ts = [], isLoading } = useTransitions();
  const save = useSaveTransition(); const del = useDeleteTransition();
  const [from, setFrom] = useState("draft"); const [to, setTo] = useState("confirmed"); const [sla, setSla] = useState("");

  const cell = (f: string, t: string) => ts.find((x) => x.from_status === f && x.to_status === t);

  return (
    <div className="space-y-5">
      <PageHeader title="Order Workflow" subtitle={isLoading ? "Loading…" : `${ts.filter((t) => t.enabled).length} allowed status changes · the system blocks any other change`} />

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Allowed transitions</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">Rows are the current status, columns the next status. Click a cell to allow or block it.</p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead><tr><th className="p-2 text-left text-[10px] uppercase text-muted-foreground">From \ To</th>
              {ORDER_STATUSES.map((s) => <th key={s} className="p-2 text-[10px] uppercase capitalize text-muted-foreground">{label(s)}</th>)}</tr></thead>
            <tbody>{ORDER_STATUSES.map((f) => (
              <tr key={f} className="border-t border-border/40">
                <td className="p-2 font-medium capitalize">{label(f)}</td>
                {ORDER_STATUSES.map((t) => {
                  if (f === t) return <td key={t} className="p-2 text-center text-muted-foreground/40">—</td>;
                  const c = cell(f, t);
                  return (
                    <td key={t} className="p-1 text-center">
                      <button
                        onClick={() => c ? save.mutate({ id: c.id, enabled: !c.enabled, version: c.version + 1 }) : save.mutate({ from_status: f, to_status: t })}
                        className={`h-7 w-full min-w-14 rounded-md border text-[10px] ${c?.enabled ? "border-success/40 bg-success/15 text-success" : "border-border/40 text-muted-foreground hover:border-primary/40"}`}>
                        {c?.enabled ? (c.sla_hours ? `${c.sla_hours}h` : "allowed") : "blocked"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Time limits (SLA) and versions</h3>
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <select value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-xs">{ORDER_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
          <span className="pb-2 text-xs">→</span>
          <select value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-xs">{ORDER_STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
          <input value={sla} onChange={(e) => setSla(e.target.value)} type="number" min={0} placeholder="SLA hours" className="h-9 w-28 rounded-lg border border-border/60 bg-card/60 px-2 text-xs" />
          <button disabled={from === to} onClick={() => {
            const c = cell(from, to); const h = sla ? Math.round(Number(sla)) : null;
            if (c) save.mutate({ id: c.id, enabled: true, sla_hours: h, version: c.version + 1 }); else save.mutate({ from_status: from, to_status: to, sla_hours: h });
          }} className="flex h-9 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs text-primary disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Save transition</button>
        </div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-1 text-left">From</th><th className="text-left">To</th><th className="text-left">SLA</th><th className="text-left">Version</th><th className="text-left">State</th><th /></tr></thead>
          <tbody>{ts.map((t) => (
            <tr key={t.id} className="border-t border-border/40">
              <td className="py-1.5 capitalize">{label(t.from_status)}</td><td className="capitalize">{label(t.to_status)}</td>
              <td>{t.sla_hours ? `${t.sla_hours} h` : "—"}</td><td>v{t.version}</td>
              <td className={t.enabled ? "text-success" : "text-muted-foreground"}>{t.enabled ? "Allowed" : "Blocked"}</td>
              <td className="text-right"><button onClick={() => del.mutate(t.id)} aria-label="Remove"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button></td>
            </tr>))}</tbody>
        </table>
      </Panel>
    </div>
  );
}
