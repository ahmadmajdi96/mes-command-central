import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, ArrowUpCircle } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { AnalyticsCards } from "@/components/analytics-cards";
import { CSVExportButton } from "@/components/csv-export-button";
import { StatusPill } from "@/components/status-pill";
import { ExceptionEditor } from "@/components/exception-editor";
import { PriorityQueuePanel } from "@/components/priority-queue-panel";
import { ExceptionAssignmentPanel } from "@/components/exception-assignment-panel";
import { useOrders, useRealtimeInvalidate } from "@/lib/oms-db";
import { ageHours, excKey, isOpenExc, useDeleteException, useEscalate, useExceptions, usePeople, type OrderException } from "@/lib/exceptions-db";

export const Route = createFileRoute("/exceptions")({
  head: () => ({ meta: [
    { title: "Exceptions · OMS" },
    { name: "description", content: "Track order exceptions by type, severity and owner, with aging and automatic escalation." },
    { property: "og:title", content: "Exceptions · OMS" },
    { property: "og:description", content: "Track order exceptions by type, severity and owner, with aging and automatic escalation." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ExceptionsPage,
});

const QUEUES = ["Open", "Overdue", "Escalated", "Critical / high", "Unassigned", "Resolved", "All"] as const;
type Q = typeof QUEUES[number];
const sevColor: Record<string, string> = { low: "text-muted-foreground", medium: "text-info", high: "text-warning", critical: "text-destructive" };

function ExceptionsPage() {
  useRealtimeInvalidate("order_exceptions" as never, [excKey]);
  const { data: rows = [], isLoading } = useExceptions();
  const { data: orders = [] } = useOrders();
  const { data: people = [] } = usePeople();
  const escalate = useEscalate(); const del = useDeleteException();
  const [q, setQ] = useState<Q>("Open");
  const [edit, setEdit] = useState<Partial<OrderException> | null>(null);

  const overdue = (e: OrderException) => isOpenExc(e) && new Date(e.due_at) < new Date();
  const test: Record<Q, (e: OrderException) => boolean> = {
    Open: isOpenExc, Overdue: overdue, Escalated: (e) => e.status === "escalated",
    "Critical / high": (e) => isOpenExc(e) && ["critical", "high"].includes(e.severity),
    Unassigned: (e) => isOpenExc(e) && !e.owner_id, Resolved: (e) => !isOpenExc(e), All: () => true,
  };
  const filtered = rows.filter(test[q]);
  const open = rows.filter(isOpenExc);
  const avgAge = open.length ? Math.round(open.reduce((s, e) => s + ageHours(e.created_at), 0) / open.length) : 0;
  const cards = useMemo(() => [
    { label: "Open", value: open.length, accent: "primary" as const },
    { label: "Overdue", value: rows.filter(overdue).length, accent: "destructive" as const },
    { label: "Escalated", value: rows.filter(test.Escalated).length, accent: "warning" as const },
    { label: "Critical / high", value: rows.filter(test["Critical / high"]).length, accent: "destructive" as const },
    { label: "Avg open age", value: `${avgAge}h`, accent: "info" as const },
    { label: "Resolved", value: rows.filter(test.Resolved).length, accent: "success" as const },
  ], [rows]);
  const ord = (id: string | null) => orders.find((o) => o.id === id);
  const who = (id: string | null) => { const p = people.find((x) => x.id === id); return p ? (p.display_name || p.email) : "Unassigned"; };
  const age = (e: OrderException) => { const h = ageHours(e.created_at); return h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)}d`; };

  return (
    <div className="space-y-5">
      <PageHeader title="Exceptions" subtitle={isLoading ? "Loading…" : `${open.length} open · ${rows.length} total`}
        actions={<>
          <button onClick={() => escalate.mutate(undefined)} className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning"><ArrowUpCircle className="h-3.5 w-3.5" /> Run escalator</button>
          <CSVExportButton filename={`exceptions-${q}`} rows={filtered} columns={[
            { key: "number", label: "Number" }, { key: "title", label: "Title" }, { key: "type", label: "Type" }, { key: "severity", label: "Severity" },
            { key: "status", label: "Status" }, { key: "owner", label: "Owner", get: (r) => who(r.owner_id) }, { key: "order", label: "Order", get: (r) => ord(r.order_id)?.number ?? "" },
            { key: "age", label: "Age hours", get: (r) => Math.round(ageHours(r.created_at)) }, { key: "escalation_level", label: "Escalation level" }, { key: "resolution", label: "Resolution" },
          ]} />
          <button onClick={() => setEdit({})} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary"><Plus className="h-3.5 w-3.5" /> New exception</button>
        </>} />
      <AnalyticsCards cards={cards} />
      <PriorityQueuePanel limit={15} />
      <ExceptionAssignmentPanel />
      <div className="glass-panel flex flex-wrap gap-1 rounded-2xl p-3">
        {QUEUES.map((x) => <button key={x} onClick={() => setQ(x)} className={`rounded-lg px-2.5 py-1 text-[11px] ${q === x ? "border border-primary/30 bg-primary/15 text-primary" : "border border-transparent text-muted-foreground"}`}>{x}</button>)}
      </div>
      <DataTable<OrderException> rows={filtered} defaultSort={{ key: "age", dir: "desc" }} empty="Nothing in this queue" columns={[
        { key: "number", label: "Exception", sortAccessor: (r) => r.number, render: (r) => <button onClick={() => setEdit(r)} className="font-mono text-xs text-primary hover:underline">{r.number}</button> },
        { key: "title", label: "Title", render: (r) => <span className="text-xs">{r.title}<span className="block text-[10px] capitalize text-muted-foreground">{r.type.replace(/_/g, " ")} · {r.source}</span></span> },
        { key: "order", label: "Order", render: (r) => { const o = ord(r.order_id); return o ? <Link to="/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-xs text-primary hover:underline">{o.number}</Link> : <span className="text-xs text-muted-foreground">—</span>; } },
        { key: "sev", label: "Severity", sortAccessor: (r) => ["low", "medium", "high", "critical"].indexOf(r.severity), render: (r) => <span className={`text-xs font-medium capitalize ${sevColor[r.severity]}`}>{r.severity}</span> },
        { key: "status", label: "Status", render: (r) => <span className="flex items-center gap-1"><StatusPill status={r.status} />{r.escalation_level > 0 && <span className="text-[10px] text-warning">L{r.escalation_level}</span>}</span> },
        { key: "owner", label: "Owner", render: (r) => <span className={`text-xs ${r.owner_id ? "" : "text-muted-foreground"}`}>{who(r.owner_id)}</span> },
        { key: "age", label: "Age", sortAccessor: (r) => ageHours(r.created_at), render: (r) => <span className="font-mono text-xs">{age(r)}</span> },
        { key: "due", label: "Due", sortAccessor: (r) => r.due_at, render: (r) => <span className={`font-mono text-xs ${overdue(r) ? "text-destructive" : "text-muted-foreground"}`}>{isOpenExc(r) ? new Date(r.due_at).toLocaleString() : "—"}</span> },
        { key: "a", label: "", align: "right", render: (r) => <span className="flex justify-end gap-2 text-xs"><button className="text-primary hover:underline" onClick={() => setEdit(r)}>Open</button><button className="text-destructive hover:underline" onClick={() => confirm(`Delete ${r.number}?`) && del.mutate(r.id)}>Delete</button></span> },
      ]} />
      <ExceptionEditor open={!!edit} onOpenChange={(v) => !v && setEdit(null)} initial={edit} orders={orders} />
    </div>
  );
}
