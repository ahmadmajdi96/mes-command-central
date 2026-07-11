import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { productionOrders, findProduct, findSO } from "@/lib/oms-data";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, DataTable } from "@/components/page-shell";

export const Route = createFileRoute("/production-orders/")({
  head: () => ({ meta: [{ title: "Production Orders · CORTA OMS" }] }),
  component: POList,
});

function POList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const filters = ["all", "planned", "released", "in_progress", "completed", "cancelled"];
  const filtered = useMemo(() => productionOrders.filter(p => {
    if (status !== "all" && p.status !== status) return false;
    if (q) return p.number.toLowerCase().includes(q.toLowerCase()) || (findProduct(p.productId)?.name.toLowerCase().includes(q.toLowerCase()) ?? false);
    return true;
  }), [q, status]);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Production Orders"
        subtitle={`${filtered.length} of ${productionOrders.length}`}
        actions={
          <button className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
            <Plus className="h-3.5 w-3.5" /> New Production Order
          </button>
        }
      />
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search # or product…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1">
          {filters.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${status === s ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>
      <DataTable
        rows={filtered}
        columns={[
          { key: "number", label: "PO", render: (p) => (
            <Link to="/production-orders/$poId" params={{ poId: p.id }} className="font-mono text-xs text-primary hover:underline">{p.number}</Link>
          )},
          { key: "so", label: "Sales Order", render: (p) => p.salesOrderId ? (
            <Link to="/orders/$orderId" params={{ orderId: p.salesOrderId }} className="font-mono text-xs text-muted-foreground hover:text-primary">{findSO(p.salesOrderId)?.number}</Link>
          ) : <span className="text-xs text-muted-foreground">—</span> },
          { key: "product", label: "Product", render: (p) => <span className="text-sm">{findProduct(p.productId)?.name}</span> },
          { key: "qty", label: "Qty", render: (p) => <span className="font-mono text-sm">{p.qtyProduced}/{p.qty}</span> },
          { key: "start", label: "Planned", render: (p) => <span className="font-mono text-xs">{p.plannedStart} → {p.plannedEnd}</span> },
          { key: "prio", label: "Prio", render: (p) => (
            <span className={`font-mono text-xs ${p.priority >= 3 ? "text-destructive" : p.priority === 2 ? "text-warning" : "text-muted-foreground"}`}>
              P{p.priority}
            </span>
          )},
          { key: "status", label: "Status", render: (p) => <StatusPill status={p.status} /> },
        ]}
      />
    </div>
  );
}
