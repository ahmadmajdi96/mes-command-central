import { createFileRoute, Link } from "@tanstack/react-router";
import { shipments, findSO, findCustomer, type Shipment } from "@/lib/oms-data";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { Plus, Truck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/shipments")({
  head: () => ({ meta: [{ title: "Shipments · CORTA OMS" }] }),
  component: ShipmentsPage,
});

const filters = ["all", "draft", "packed", "shipped", "delivered"];

function ShipmentsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = useMemo(() => shipments.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (q) {
      const t = q.toLowerCase();
      return s.number.toLowerCase().includes(t) || s.carrier.toLowerCase().includes(t) || s.tracking.toLowerCase().includes(t);
    }
    return true;
  }), [q, status]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shipments"
        subtitle={`${filtered.length} of ${shipments.length} · ${shipments.filter((s) => s.status === "delivered").length} delivered`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="shipments"
              rows={filtered}
              columns={[
                { key: "number", label: "Shipment #" },
                { key: "salesOrderId", label: "Sales Order" },
                { key: "customer", label: "Customer", get: (s) => {
                  const so = findSO(s.salesOrderId);
                  return so ? findCustomer(so.customerId)?.name : "";
                }},
                { key: "carrier", label: "Carrier" },
                { key: "tracking", label: "Tracking" },
                { key: "status", label: "Status" },
                { key: "shippedAt", label: "Shipped At" },
              ]}
            />
            <button onClick={() => toast.success("New shipment (demo)")}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Plus className="h-3.5 w-3.5" /> New Shipment
            </button>
          </div>
        }
      />

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search shipment #, carrier, tracking…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1">
          {filters.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${status === s ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <DataTable<Shipment>
        rows={filtered}
        defaultSort={{ key: "num", dir: "asc" }}
        columns={[
          { key: "num", label: "Shipment", sortAccessor: (s) => s.number, render: (s) => (
            <span className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-primary" /><span className="font-mono text-xs text-primary">{s.number}</span></span>
          )},
          { key: "so", label: "Sales Order", sortAccessor: (s) => s.salesOrderId, render: (s) => {
            const so = findSO(s.salesOrderId);
            return so ? <Link to="/orders/$orderId" params={{ orderId: so.id }} className="font-mono text-xs text-primary hover:underline">{so.number}</Link> : "—";
          }},
          { key: "cust", label: "Customer", sortAccessor: (s) => {
            const so = findSO(s.salesOrderId);
            return so ? findCustomer(so.customerId)?.name ?? "" : "";
          }, render: (s) => {
            const so = findSO(s.salesOrderId);
            return <span className="text-sm">{so ? findCustomer(so.customerId)?.name : "—"}</span>;
          }},
          { key: "carrier", label: "Carrier", sortAccessor: (s) => s.carrier, render: (s) => <span className="text-xs">{s.carrier}</span> },
          { key: "tracking", label: "Tracking", render: (s) => <span className="font-mono text-xs text-muted-foreground">{s.tracking}</span> },
          { key: "shipped", label: "Shipped", sortAccessor: (s) => s.shippedAt ?? "", render: (s) => <span className="font-mono text-xs">{s.shippedAt ?? "—"}</span> },
          { key: "status", label: "Status", sortAccessor: (s) => s.status, render: (s) => <StatusPill status={s.status} /> },
        ]}
      />
    </div>
  );
}
