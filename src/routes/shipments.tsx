import { createFileRoute, Link } from "@tanstack/react-router";
import { shipments, findSO, findCustomer } from "@/lib/oms-data";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, DataTable } from "@/components/page-shell";
import { Plus, Truck } from "lucide-react";

export const Route = createFileRoute("/shipments")({
  head: () => ({ meta: [{ title: "Shipments · CORTA OMS" }] }),
  component: ShipmentsPage,
});

function ShipmentsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Shipments"
        subtitle={`${shipments.length} shipments · ${shipments.filter(s => s.status === "delivered").length} delivered`}
        actions={
          <button className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <Plus className="h-3.5 w-3.5" /> New Shipment
          </button>
        }
      />
      <DataTable
        rows={shipments}
        columns={[
          { key: "num", label: "Shipment", render: (s) => (
            <span className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-primary" /><span className="font-mono text-xs text-primary">{s.number}</span></span>
          )},
          { key: "so", label: "Sales Order", render: (s) => {
            const so = findSO(s.salesOrderId);
            return so ? <Link to="/orders/$orderId" params={{ orderId: so.id }} className="font-mono text-xs text-primary hover:underline">{so.number}</Link> : "—";
          }},
          { key: "cust", label: "Customer", render: (s) => {
            const so = findSO(s.salesOrderId);
            return <span className="text-sm">{so ? findCustomer(so.customerId)?.name : "—"}</span>;
          }},
          { key: "carrier", label: "Carrier", render: (s) => <span className="text-xs">{s.carrier}</span> },
          { key: "tracking", label: "Tracking", render: (s) => <span className="font-mono text-xs text-muted-foreground">{s.tracking}</span> },
          { key: "shipped", label: "Shipped", render: (s) => <span className="font-mono text-xs">{s.shippedAt ?? "—"}</span> },
          { key: "status", label: "Status", render: (s) => <StatusPill status={s.status} /> },
        ]}
      />
    </div>
  );
}
