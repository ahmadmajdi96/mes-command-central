import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Edit, Trash2, XCircle, Truck } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { useOrder, useUpdateOrder, useDeleteOrder, useShipments, useRealtimeInvalidate, useUpdateOrderLine, ordersKey, orderKey } from "@/lib/oms-db";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormDialog } from "@/components/form-dialog";
import { orderStatusOptions } from "@/lib/oms-db";

export const Route = createFileRoute("/orders/$orderId")({
  head: ({ params }) => ({ meta: [{ title: `${params.orderId} · Sales Order · CORTA OMS` }] }),
  component: OrderDetail,
  notFoundComponent: () => (
    <div className="glass-panel rounded-2xl p-8 text-center">
      <p className="text-sm text-muted-foreground">Sales order not found.</p>
      <Link to="/orders" className="mt-3 inline-flex text-xs text-primary hover:underline">Back to orders</Link>
    </div>
  ),
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function OrderDetail() {
  const { orderId } = Route.useParams();
  const router = useRouter();
  useRealtimeInvalidate("sales_orders", [ordersKey, orderKey(orderId)]);

  const { data: so, isLoading } = useOrder(orderId);
  const { data: shipments = [] } = useShipments();
  const update = useUpdateOrder();
  const del = useDeleteOrder();

  const [openEdit, setOpenEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!so) return <p className="text-sm text-muted-foreground">Not found</p>;

  const lines = (so.lines as any[]) ?? [];
  const customer = (so as any).customer;
  const relatedShipments = shipments.filter((s) => s.order_id === so.id);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/orders" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Sales Orders</span></Link>}
        title={so.number}
        subtitle={`${customer?.name ?? "—"} · Ordered ${so.order_date} · Due ${so.due_date ?? "—"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={so.status} />
            {true && (
              <>
                <button onClick={() => setOpenEdit(true)} className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card"><Edit className="h-3.5 w-3.5" /> Edit</button>
                <button onClick={() => update.mutate({ id: so.id, patch: { status: "cancelled" }, note: "Cancelled order" })}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20">
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </button>
                <button onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel className="lg:col-span-3">
          <h3 className="mb-3 text-sm font-semibold">Order Lines</h3>
          {lines.length === 0 ? (
            <p className="text-xs text-muted-foreground">No lines on this order yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Due</th>
                    <th className="pb-2 font-medium">Qty</th>
                    <th className="pb-2 font-medium text-right">Unit</th>
                    <th className="pb-2 font-medium text-right">Subtotal</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line: any) => (
                    <tr key={line.id} className="border-b border-border/30">
                      <td className="py-3">
                        <div className="flex items-center gap-2 text-sm">
                          {line.product?.name ?? "—"}
                          {line.batch_of && (
                            <span className="rounded-full border border-info/40 bg-info/10 px-2 py-0.5 font-mono text-[10px] text-info">
                              batch {line.batch_index}/{line.batch_of}
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">{line.product?.sku}</div>
                      </td>
                      <td className="py-3 font-mono text-xs">{line.due_date ?? "—"}</td>
                      <td className="py-3 font-mono text-sm">{line.qty}</td>
                      <td className="py-3 text-right font-mono text-sm">${Number(line.unit_price).toLocaleString()}</td>
                      <td className="py-3 text-right font-mono text-sm">${(Number(line.qty) * Number(line.unit_price)).toLocaleString()}</td>
                      <td className="py-3"><StatusPill status={line.status} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="pt-3 text-right text-xs text-muted-foreground">Order total</td>
                    <td className="pt-3 text-right font-mono text-lg font-semibold text-primary">${Number(so.total).toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {so.notes && (
            <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
              <span className="text-warning font-medium">Note</span> · {so.notes}
            </div>
          )}
        </Panel>

        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Customer</h3>
          {customer ? (
            <div className="space-y-3">
              <Field label="Name" value={customer.name} />
              <Field label="Contact" value={customer.contact} />
              <Field label="Email" value={customer.email} />
              <Field label="Phone" value={customer.phone} mono />
              <Field label="Address" value={customer.address} />
              <Link to="/customers/$customerId" params={{ customerId: customer.id }} className="mt-2 inline-flex text-xs text-primary hover:underline">View customer →</Link>
            </div>
          ) : <p className="text-xs text-muted-foreground">No customer linked.</p>}
        </Panel>
      </div>

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Shipments</h3>
          <span className="text-[11px] text-muted-foreground">{relatedShipments.length} linked</span>
        </div>
        {relatedShipments.length === 0 ? (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> No shipments yet.</p>
        ) : (
          <div className="space-y-2">
            {relatedShipments.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
                <div>
                  <div className="font-mono text-xs text-primary">{s.number}</div>
                  <div className="text-xs text-muted-foreground">{s.carrier ?? "—"} · {s.tracking ?? "—"}</div>
                </div>
                <StatusPill status={s.status} />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this order?"
        description="This permanently deletes the order and all its lines."
        confirmLabel="Delete order"
        variant="destructive"
        onConfirm={async () => {
          await del.mutateAsync(so.id);
          toast.success("Order deleted");
          router.navigate({ to: "/orders" });
        }}
      />

      <FormDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        title={`Edit ${so.number}`}
        submitLabel="Save changes"
        initial={{
          status: so.status, order_date: so.order_date, due_date: so.due_date ?? "",
          total: Number(so.total), currency: so.currency, notes: so.notes ?? "",
        } as any}
        fields={[
          { name: "status", label: "Status", type: "select",
            options: orderStatusOptions.map((s) => ({ value: s, label: s.replace("_", " ") })) },
          { name: "order_date", label: "Order date", type: "date" },
          { name: "due_date", label: "Due date", type: "date" },
          { name: "total", label: "Total", type: "number", step: 0.01 },
          { name: "currency", label: "Currency" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v: any) => {
          await update.mutateAsync({
            id: so.id,
            patch: { status: v.status, order_date: v.order_date || null, due_date: v.due_date || null, total: v.total, currency: v.currency, notes: v.notes || null },
            note: "Edited order",
          });
          toast.success("Order updated");
        }}
      />
    </div>
  );
}
