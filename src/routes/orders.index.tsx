import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Filter, Pencil, Trash2 } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { SavedPresetsBar } from "@/components/saved-presets-bar";
import { NewOrderDialog } from "@/components/new-order-dialog";
import { toast } from "sonner";
import {
  useOrders, useBulkUpdateOrderStatus, useUpdateOrder, useDeleteOrder,
  useCustomers, useRealtimeInvalidate,
  ordersKey, orderStatusOptions, type OrderWithCustomer,
} from "@/lib/oms-db";

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "Sales Orders · CORTA OMS" }] }),
  component: OrdersList,
});

const statusFilters = ["all", ...orderStatusOptions];
type OrdersPreset = { q: string; status: string };

function OrdersList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<OrderWithCustomer | null>(null);
  const [deleting, setDeleting] = useState<OrderWithCustomer | null>(null);
  useRealtimeInvalidate("sales_orders", [ordersKey]);

  const { data: orders = [], isLoading } = useOrders();
  const { data: customers = [] } = useCustomers();
  const bulkUpdate = useBulkUpdateOrderStatus();
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();

  const [confirm, setConfirm] = useState<
    | null
    | { ids: string[]; clear: () => void; targetStatus: string; label: string; variant?: "destructive" }
  >(null);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (q) {
        const c = (o.customer?.name ?? "").toLowerCase();
        return o.number.toLowerCase().includes(q.toLowerCase()) || c.includes(q.toLowerCase());
      }
      return true;
    });
  }, [q, status, orders]);

  const runBulk = async () => {
    if (!confirm) return;
    try {
      const res = await bulkUpdate.mutateAsync({ ids: confirm.ids, status: confirm.targetStatus, label: confirm.label });
      const extra = res && res.pos ? ` · ${res.pos} PO / ${res.batches} batch(es) created` : "";
      toast.success(`${confirm.label}: ${confirm.ids.length} order(s)${extra}`);
      confirm.clear();
      setConfirm(null);
    } catch (e: any) { toast.error(e.message ?? "Bulk update failed"); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Orders"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${orders.length} orders`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="sales-orders"
              rows={filtered}
              columns={[
                { key: "number", label: "Order #" },
                { key: "customer", label: "Customer", get: (o) => o.customer?.name ?? "" },
                { key: "order_date", label: "Order Date" },
                { key: "due_date", label: "Due Date" },
                { key: "status", label: "Status" },
                { key: "lines", label: "Lines", get: (o) => o.lines_count ?? 0 },
                { key: "total", label: "Total" },
                { key: "currency", label: "Currency" },
              ]}
            />
            {true && (
              <button onClick={() => setOpenNew(true)}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
                <Plus className="h-3.5 w-3.5" /> New Order
              </button>
            )}
          </div>
        }
      />

      <SavedPresetsBar<OrdersPreset>
        pageKey="orders"
        current={{ q, status }}
        onApply={(p) => { setQ(p.q ?? ""); setStatus(p.status ?? "all"); }}
      />

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by order # or customer…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {statusFilters.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize whitespace-nowrap ${status === s ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <DataTable<OrderWithCustomer>
        rows={filtered}
        getRowId={(o) => o.id}
        defaultSort={{ key: "orderDate", dir: "desc" }}
        bulkActions={true ? (selected, clear) => (
          <>
            <button onClick={() => setConfirm({ ids: selected.map((s) => s.id), clear, targetStatus: "confirmed", label: "Confirm orders" })}
              className="rounded-md border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] text-success hover:bg-success/20">
              Confirm
            </button>
            <button onClick={() => setConfirm({ ids: selected.map((s) => s.id), clear, targetStatus: "in_production", label: "Send to production" })}
              className="rounded-md border border-info/40 bg-info/10 px-2.5 py-1 text-[11px] text-info hover:bg-info/20">
              Send to Production
            </button>
            <button onClick={() => setConfirm({ ids: selected.map((s) => s.id), clear, targetStatus: "cancelled", label: "Cancel orders", variant: "destructive" })}
              className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] text-destructive hover:bg-destructive/20">
              Cancel
            </button>
            <CSVExportButton filename="sales-orders-selection" rows={selected} label="Export selection"
              columns={[
                { key: "number", label: "Order #" },
                { key: "customer", label: "Customer", get: (o) => o.customer?.name ?? "" },
                { key: "status", label: "Status" },
                { key: "total", label: "Total" },
              ]} />
          </>
        ) : undefined}
        columns={[
          { key: "number", label: "Order", sortAccessor: (o) => o.number, render: (o) => (
            <Link to="/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-xs text-primary hover:underline">{o.number}</Link>
          )},
          { key: "customer", label: "Customer", sortAccessor: (o) => o.customer?.name ?? "", render: (o) => <span className="text-sm">{o.customer?.name ?? "—"}</span> },
          { key: "orderDate", label: "Ordered", sortAccessor: (o) => o.order_date ?? "", render: (o) => <span className="font-mono text-xs text-muted-foreground">{o.order_date}</span> },
          { key: "dueDate", label: "Due", sortAccessor: (o) => o.due_date ?? "", render: (o) => <span className="font-mono text-xs">{o.due_date ?? "—"}</span> },
          { key: "lines", label: "Lines", sortAccessor: (o) => o.lines_count ?? 0, render: (o) => <span className="font-mono text-xs">{o.lines_count ?? 0}</span> },
          { key: "status", label: "Status", sortAccessor: (o) => o.status, render: (o) => <StatusPill status={o.status} /> },
          { key: "total", label: "Total", align: "right", sortAccessor: (o) => Number(o.total), render: (o) => <span className="font-mono text-sm">${Number(o.total).toLocaleString()}</span> },
          { key: "actions", label: "", render: (o: OrderWithCustomer) => (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => setEditing(o)}
                className="rounded-md border border-border/60 bg-card/60 p-1.5 text-muted-foreground hover:text-foreground"
                aria-label="Edit order">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setDeleting(o)}
                className="rounded-md border border-destructive/40 bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                aria-label="Delete order">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )},
        ]}
        empty={isLoading ? "Loading…" : "No orders match your filters"}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm?.label ?? ""}
        description={
          confirm
            ? `This will update ${confirm.ids.length} order(s) to "${confirm.targetStatus.replace("_", " ")}" and log an audit entry for each record.`
            : ""
        }
        confirmLabel={confirm?.variant === "destructive" ? "Yes, cancel orders" : "Apply update"}
        variant={confirm?.variant}
        onConfirm={runBulk}
      />

      <NewOrderDialog open={openNew} onOpenChange={setOpenNew} />

      <FormDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        title={editing ? `Edit ${editing.number}` : "Edit order"}
        submitLabel="Save changes"
        initial={editing ? {
          customer_id: editing.customer_id ?? "",
          status: editing.status,
          order_date: editing.order_date ?? "",
          due_date: editing.due_date ?? "",
          currency: editing.currency ?? "USD",
          notes: (editing as any).notes ?? "",
        } as any : undefined}
        fields={[
          { name: "customer_id", label: "Customer", type: "select", required: true,
            options: customers.map((c) => ({ value: c.id, label: c.name })) },
          { name: "status", label: "Status", type: "select",
            options: orderStatusOptions.map((s) => ({ value: s, label: s.replace("_", " ") })) },
          { name: "order_date", label: "Order date", type: "date" },
          { name: "due_date", label: "Due date", type: "date" },
          { name: "currency", label: "Currency" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v: any) => {
          if (!editing) return;
          try {
            await updateOrder.mutateAsync({
              id: editing.id,
              patch: {
                customer_id: v.customer_id || null,
                status: v.status || editing.status,
                order_date: v.order_date || null,
                due_date: v.due_date || null,
                currency: v.currency || "USD",
                notes: v.notes || null,
              },
            });
            toast.success(`Order ${editing.number} updated`);
            setEditing(null);
          } catch (e: any) {
            toast.error(e?.message ?? "Failed to update order");
          }
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={deleting ? `Delete ${deleting.number}?` : "Delete order?"}
        description="This permanently removes the sales order and its lines."
        confirmLabel="Delete order"
        variant="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteOrder.mutateAsync(deleting.id);
            toast.success(`Order ${deleting.number} deleted`);
            setDeleting(null);
          } catch (e: any) {
            toast.error(e?.message ?? "Failed to delete order");
          }
        }}
      />
    </div>
  );
}
