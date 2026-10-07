import { PriorityQueuePanel } from "@/components/priority-queue-panel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Workflow } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { AnalyticsCards } from "@/components/analytics-cards";
import { CSVExportButton } from "@/components/csv-export-button";
import { StatusPill } from "@/components/status-pill";
import { useCustomers, useRealtimeInvalidate } from "@/lib/oms-db";
import { orchKey, useMonitor, useOrchestrate, type MonitorRow } from "@/lib/orchestration-db";

export const Route = createFileRoute("/orchestration")({
  head: () => ({ meta: [
    { title: "Orchestration Monitor · OMS" },
    { name: "description", content: "Find orders that are stuck, held, past their time limit or failed sourcing." },
    { property: "og:title", content: "Orchestration Monitor · OMS" },
    { property: "og:description", content: "Find orders that are stuck, held, past their time limit or failed sourcing." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MonitorPage,
});

const QUEUES = ["All open", "Past SLA", "On hold", "Sourcing failed", "Unallocated", "Ready to source"] as const;
type Q = typeof QUEUES[number];
const CLOSED = ["shipped", "delivered", "cancelled"];

function MonitorPage() {
  useRealtimeInvalidate("sales_orders", [orchKey]);
  useRealtimeInvalidate("order_milestones" as never, [orchKey]);
  const { data: rows = [], isLoading } = useMonitor();
  const { data: customers = [] } = useCustomers();
  const run = useOrchestrate();
  const [q, setQ] = useState<Q>("All open");

  const late = (r: MonitorRow) => r.sla_hours != null && Number(r.hours_in_status) > r.sla_hours;
  const open = rows.filter((r) => !CLOSED.includes(r.status));
  const test: Record<Q, (r: MonitorRow) => boolean> = {
    "All open": () => true,
    "Past SLA": late,
    "On hold": (r) => r.status === "on_hold",
    "Sourcing failed": (r) => Number(r.failed_steps) > 0,
    "Unallocated": (r) => Number(r.unallocated_qty) > 0 && r.status !== "draft",
    "Ready to source": (r) => r.status === "confirmed",
  };
  const filtered = open.filter(test[q]);
  const cards = useMemo(() => QUEUES.map((name, i) => ({
    label: name, value: open.filter(test[name]).length,
    accent: (["primary", "destructive", "warning", "destructive", "info", "success"] as const)[i],
  })), [rows]);
  const cust = (id: string | null) => customers.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-5">
      <PageHeader title="Orchestration Monitor" subtitle={isLoading ? "Loading…" : `${open.length} open orders`}
        actions={<CSVExportButton filename={`orchestration-${q}`} rows={filtered} columns={[
          { key: "number", label: "Order" }, { key: "status", label: "Status" }, { key: "channel", label: "Channel" },
          { key: "hours_in_status", label: "Hours in status", get: (r) => Math.round(Number(r.hours_in_status)) }, { key: "sla_hours", label: "SLA h" },
          { key: "failed_steps", label: "Failed steps" }, { key: "unallocated_qty", label: "Unallocated" }, { key: "last_milestone", label: "Last milestone" },
        ]} />} />
      <AnalyticsCards cards={cards} />
      <PriorityQueuePanel title="Problems needing attention" />
      <div className="glass-panel flex flex-wrap gap-1 rounded-2xl p-3">
        {QUEUES.map((x) => <button key={x} onClick={() => setQ(x)} className={`rounded-lg px-2.5 py-1 text-[11px] ${q === x ? "border border-primary/30 bg-primary/15 text-primary" : "border border-transparent text-muted-foreground"}`}>{x}</button>)}
      </div>
      <DataTable<MonitorRow> rows={filtered} defaultSort={{ key: "age", dir: "desc" }} empty="Nothing in this queue" columns={[
        { key: "number", label: "Order", sortAccessor: (r) => r.number, render: (r) => <Link to="/orders/$orderId" params={{ orderId: r.id }} className="font-mono text-xs text-primary hover:underline">{r.number}</Link> },
        { key: "customer", label: "Customer", render: (r) => <span className="text-xs">{cust(r.customer_id)}</span> },
        { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
        { key: "channel", label: "Channel / route", render: (r) => <span className="text-xs">{r.channel}{r.route ? ` · ${r.route}` : ""}</span> },
        { key: "age", label: "In status", sortAccessor: (r) => Number(r.hours_in_status), render: (r) => (
          <span className={`font-mono text-xs ${late(r) ? "text-destructive" : ""}`}>{Math.round(Number(r.hours_in_status))}h{r.sla_hours ? ` / ${r.sla_hours}h` : ""}</span>) },
        { key: "failed", label: "Failed", align: "right", sortAccessor: (r) => Number(r.failed_steps), render: (r) => <span className={`font-mono text-xs ${Number(r.failed_steps) ? "text-destructive" : ""}`}>{r.failed_steps}</span> },
        { key: "unalloc", label: "Unallocated", align: "right", sortAccessor: (r) => Number(r.unallocated_qty), render: (r) => <span className="font-mono text-xs">{Number(r.unallocated_qty)}</span> },
        { key: "ms", label: "Last milestone", render: (r) => <span className="text-xs capitalize text-muted-foreground">{(r.last_milestone ?? "—").replace(/_/g, " ")}{r.hold_reason && r.status === "on_hold" ? ` · ${r.hold_reason}` : ""}</span> },
        { key: "a", label: "", align: "right", render: (r) => ["confirmed", "on_hold", "sourced"].includes(r.status) ? (
          <button onClick={() => run.mutate(r.id)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Workflow className="h-3 w-3" /> Source</button>) : null },
      ]} />
    </div>
  );
}
