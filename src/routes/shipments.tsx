import { createFileRoute, Link } from "@tanstack/react-router";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SavedPresetsBar } from "@/components/saved-presets-bar";
import { Plus, Truck, Search, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useShipments, useCreateShipment, useUpdateShipment, useDeleteShipment,
  useOrders, useCustomers,
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
  const [editing, setEditing] = useState<ShipmentWithOrder | null>(null);
  const [deleting, setDeleting] = useState<ShipmentWithOrder | null>(null);
  useRealtimeInvalidate("shipments", [shipmentsKey]);

  const { data: shipments = [], isLoading } = useShipments();
  const { data: orders = [] } = useOrders();
  const { data: customers = [] } = useCustomers();
  const createShipment = useCreateShipment();
  const updateShipment = useUpdateShipment();
  const deleteShipment = useDeleteShipment();

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
            {true && (
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
          ...(true ? [{
            key: "actions", label: "", render: (s: ShipmentWithOrder) => (
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => setEditing(s)}
                  className="rounded-md border border-border/60 bg-card/60 p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Edit shipment">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setDeleting(s)}
                  className="rounded-md border border-destructive/40 bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                  aria-label="Delete shipment">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ),
          }] : []),
        ]}
      />

      <FormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        title="New Shipment"
        description="Shipment # is auto-generated (SHP-YYYY-####)."
        submitLabel="Create shipment"
        fields={[
          { name: "order_id", label: "Sales Order", type: "select", required: true,
            options: orders.map((o) => ({ value: o.id, label: o.number })) },
          { name: "carrier", label: "Carrier" },
          { name: "tracking", label: "Tracking" },
          { name: "status", label: "Status", type: "select",
            options: shipmentStatusOptions.map((s) => ({ value: s, label: s })) },
          { name: "shipped_at", label: "Shipped date", type: "date" },
        ]}
        onSubmit={async (v: any) => {
          try {
            const created = await createShipment.mutateAsync({
              order_id: v.order_id || null, carrier: v.carrier || null,
              tracking: v.tracking || null, status: v.status || "draft",
              shipped_at: v.shipped_at ? new Date(v.shipped_at).toISOString() : null,
            });
            if (!created?.number) {
              toast.error("Shipment saved but auto-number failed — refresh to verify");
            } else {
              toast.success(`Shipment ${created.number} created`);
            }
          } catch (e: any) {
            toast.error(e?.message ?? "Failed to create shipment");
          }
        }}
      />

      <FormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={editing ? `Edit ${editing.number}` : "Edit shipment"}
        submitLabel="Save changes"
        initial={editing ? {
          order_id: editing.order_id ?? "",
          carrier: editing.carrier ?? "",
          tracking: editing.tracking ?? "",
          status: editing.status,
          shipped_at: editing.shipped_at ? editing.shipped_at.slice(0, 10) : "",
        } as any : undefined}
        fields={[
          { name: "order_id", label: "Sales Order", type: "select",
            options: orders.map((o) => ({ value: o.id, label: o.number })) },
          { name: "carrier", label: "Carrier" },
          { name: "tracking", label: "Tracking" },
          { name: "status", label: "Status", type: "select",
            options: shipmentStatusOptions.map((s) => ({ value: s, label: s })) },
          { name: "shipped_at", label: "Shipped date", type: "date" },
        ]}
        onSubmit={async (v: any) => {
          if (!editing) return;
          await updateShipment.mutateAsync({
            id: editing.id,
            patch: {
              order_id: v.order_id || null,
              carrier: v.carrier || null,
              tracking: v.tracking || null,
              status: v.status || editing.status,
              shipped_at: v.shipped_at ? new Date(v.shipped_at).toISOString() : null,
            },
          });
          toast.success("Shipment updated");
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={deleting ? `Delete ${deleting.number}?` : "Delete shipment?"}
        description="This permanently removes the shipment record."
        confirmLabel="Delete shipment"
        variant="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteShipment.mutateAsync(deleting.id);
          toast.success("Shipment deleted");
          setDeleting(null);
        }}
      />
    </div>
  );
}
