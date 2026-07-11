import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { FormDialog } from "@/components/form-dialog";
import { SavedPresetsBar } from "@/components/saved-presets-bar";
import { Plus, Truck, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { permissionsFor } from "@/lib/roles";
import {
  useShipments, useCreateShipment, useOrders, useCustomers,
  useRealtimeInvalidate, shipmentsKey, shipmentStatusOptions, type ShipmentWithOrder,
} from "@/lib/oms-db";

export const Route = createFileRoute("/shipments")({
  head: () => ({ meta: [{ title: "Shipments · CORTA OMS" }] }),
  component: ShipmentsPage,
});

type Preset = { q: string; status: string };
const filters = ["all", ...shipmentStatusOptions];

function ShipmentsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [openNew, setOpenNew] = useState(false);
  const role = useStore((s) => s.role);
  const perms = permissionsFor(role);
  useRealtimeInvalidate("shipments", [shipmentsKey]);

  const { data: shipments = [], isLoading } = useShipments();
  const { data: orders = [] } = useOrders();
  const { data: customers = [] } = useCustomers();
  const createShipment = useCreateShipment();

  const customerFor = (orderId?: string | null) => {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return "";
    return customers.find((c) => c.id === o.customer_id)?.name ?? "";
  };

  const filtered = useMemo(() => shipments.filter((s) => {
    if (status !== "all" && s.status !== status) return false;
    if (q) {
      const t = q.toLowerCase();
      return s.number.toLowerCase().includes(t)
        || (s.carrier ?? "").toLowerCase().includes(t)
        || (s.tracking ?? "").toLowerCase().includes(t);
    }
    return true;
  }), [q, status, shipments]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shipments"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${shipments.length} · ${shipments.filter((s) => s.status === "delivered").length} delivered`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="shipments" rows={filtered}
              columns={[
                { key: "number", label: "Shipment #" },
                { key: "order", label: "Sales Order", get: (s) => s.order?.number ?? "" },
                { key: "customer", label: "Customer", get: (s) => customerFor(s.order_id) },
                { key: "carrier", label: "Carrier" },
                { key: "tracking", label: "Tracking" },
                { key: "status", label: "Status" },
                { key: "shipped_at", label: "Shipped At" },
              ]}
            />
            {perms.createShipment && (
              <button onClick={() => setOpenNew(true)}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Plus className="h-3.5 w-3.5" /> New Shipment
              </button>
            )}
          </div>
        }
      />

      <SavedPresetsBar<Preset> pageKey="shipments" current={{ q, status }}
        onApply={(p) => { setQ(p.q ?? ""); setStatus(p.status ?? "all"); }} />

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

      <DataTable<ShipmentWithOrder>
        rows={filtered}
        defaultSort={{ key: "num", dir: "asc" }}
        empty={isLoading ? "Loading…" : "No shipments"}
        columns={[
          { key: "num", label: "Shipment", sortAccessor: (s) => s.number, render: (s) => (
            <span className="flex items-center gap-2"><Truck className="h-3.5 w-3.5 text-primary" /><span className="font-mono text-xs text-primary">{s.number}</span></span>
          )},
          { key: "so", label: "Sales Order", sortAccessor: (s) => s.order?.number ?? "", render: (s) => (
            s.order ? <Link to="/orders/$orderId" params={{ orderId: s.order.id }} className="font-mono text-xs text-primary hover:underline">{s.order.number}</Link> : <span className="text-xs text-muted-foreground">—</span>
          )},
          { key: "cust", label: "Customer", sortAccessor: (s) => customerFor(s.order_id), render: (s) => <span className="text-sm">{customerFor(s.order_id) || "—"}</span> },
          { key: "carrier", label: "Carrier", sortAccessor: (s) => s.carrier ?? "", render: (s) => <span className="text-xs">{s.carrier}</span> },
          { key: "tracking", label: "Tracking", render: (s) => <span className="font-mono text-xs text-muted-foreground">{s.tracking ?? "—"}</span> },
          { key: "shipped", label: "Shipped", sortAccessor: (s) => s.shipped_at ?? "", render: (s) => <span className="font-mono text-xs">{s.shipped_at ? new Date(s.shipped_at).toLocaleDateString() : "—"}</span> },
          { key: "status", label: "Status", sortAccessor: (s) => s.status, render: (s) => <StatusPill status={s.status} /> },
        ]}
      />

      <FormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        title="New Shipment"
        submitLabel="Create shipment"
        fields={[
          { name: "number", label: "Shipment #", required: true, placeholder: "SHP-0778" },
          { name: "order_id", label: "Sales Order", type: "select", required: true,
            options: orders.map((o) => ({ value: o.id, label: o.number })) },
          { name: "carrier", label: "Carrier" },
          { name: "tracking", label: "Tracking" },
          { name: "status", label: "Status", type: "select",
            options: shipmentStatusOptions.map((s) => ({ value: s, label: s })) },
          { name: "shipped_at", label: "Shipped date", type: "date" },
        ]}
        onSubmit={async (v: any) => {
          await createShipment.mutateAsync({
            number: v.number, order_id: v.order_id || null, carrier: v.carrier || null,
            tracking: v.tracking || null, status: v.status || "draft",
            shipped_at: v.shipped_at ? new Date(v.shipped_at).toISOString() : null,
          });
          toast.success("Shipment created");
        }}
      />
    </div>
  );
}
