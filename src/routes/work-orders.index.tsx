import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { findWorkstation, findPO, findProduct } from "@/lib/oms-data";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/work-orders/")({
  head: () => ({ meta: [{ title: "Work Orders · CORTA OMS" }] }),
  component: WOList,
});

function WOList() {
  const workOrders = useStore((s) => s.workOrders);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const filters = ["all", "pending", "in_progress", "paused", "completed", "cancelled"];
  const filtered = useMemo(() => workOrders.filter((w) => {
    if (status !== "all" && w.status !== status) return false;
    if (q) return w.number.toLowerCase().includes(q.toLowerCase()) || w.operation.toLowerCase().includes(q.toLowerCase());
    return true;
  }), [q, status, workOrders]);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Work Orders"
        subtitle={`${filtered.length} of ${workOrders.length}`}
        actions={
          <CSVExportButton
            filename="work-orders"
            rows={filtered}
            columns={[
              { key: "number", label: "WO #" },
              { key: "operation", label: "Operation" },
              { key: "productionOrderId", label: "Production Order" },
              { key: "workstation", label: "Workstation", get: (w) => findWorkstation(w.workstationId)?.name },
              { key: "status", label: "Status" },
              { key: "qtyTarget", label: "Target" },
              { key: "qtyProduced", label: "Produced" },
              { key: "qtyScrap", label: "Scrap" },
              { key: "progress", label: "Progress %" },
              { key: "laborMin", label: "Labor Min" },
            ]}
          />
        }
      />
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search WO # or operation…"
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
          { key: "num", label: "WO", render: (w) => (
            <Link to="/work-orders/$woId" params={{ woId: w.id }} className="font-mono text-xs text-primary hover:underline">{w.number}</Link>
          )},
          { key: "op", label: "Operation", render: (w) => <span className="text-sm">{w.operation}</span> },
          { key: "po", label: "PO", render: (w) => {
            const po = findPO(w.productionOrderId);
            return po ? <Link to="/production-orders/$poId" params={{ poId: po.id }} className="font-mono text-xs text-muted-foreground hover:text-primary">{po.number}</Link> : "—";
          }},
          { key: "product", label: "Product", render: (w) => {
            const po = findPO(w.productionOrderId);
            return <span className="text-xs">{po ? findProduct(po.productId)?.name : "—"}</span>;
          }},
          { key: "ws", label: "Workstation", render: (w) => <span className="text-xs">{findWorkstation(w.workstationId)?.name}</span> },
          { key: "qty", label: "Qty", render: (w) => <span className="font-mono text-xs">{w.qtyProduced}/{w.qtyTarget}</span> },
          { key: "prog", label: "Progress", render: (w) => (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-to-r from-primary to-info" style={{ width: `${w.progress}%` }} />
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">{w.progress}%</span>
            </div>
          )},
          { key: "status", label: "Status", render: (w) => <StatusPill status={w.status} /> },
        ]}
      />
    </div>
  );
}
