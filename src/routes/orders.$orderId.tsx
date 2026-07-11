import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Edit, Factory, Truck, XCircle } from "lucide-react";
import {
  findSO, findCustomer, findProduct, productionOrders, shipments,
} from "@/lib/oms-data";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, Panel, Field } from "@/components/page-shell";

export const Route = createFileRoute("/orders/$orderId")({
  head: ({ params }) => ({ meta: [{ title: `${params.orderId} · Sales Order · CORTA OMS` }] }),
  loader: ({ params }) => {
    const so = findSO(params.orderId);
    if (!so) throw notFound();
    return so;
  },
  component: OrderDetail,
  notFoundComponent: () => (
    <div className="glass-panel rounded-2xl p-8 text-center">
      <p className="text-sm text-muted-foreground">Sales order not found.</p>
      <Link to="/orders" className="mt-3 inline-flex text-xs text-primary hover:underline">Back to orders</Link>
    </div>
  ),
});

function OrderDetail() {
  const so = Route.useLoaderData();
  const customer = findCustomer(so.customerId);
  const relatedPOs = productionOrders.filter(p => p.salesOrderId === so.id);
  const relatedShipments = shipments.filter(s => s.salesOrderId === so.id);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/orders" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Sales Orders</span></Link>}
        title={so.number}
        subtitle={`${customer?.name} · Ordered ${so.orderDate} · Due ${so.dueDate}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={so.status} />
            <button className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card"><Edit className="h-3.5 w-3.5" /> Edit</button>
            <button className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"><Factory className="h-3.5 w-3.5" /> Create Production Order</button>
            <button className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20"><XCircle className="h-3.5 w-3.5" /> Cancel</button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel className="lg:col-span-3">
          <h3 className="mb-3 text-sm font-semibold">Order Lines</h3>
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
                {so.lines.map((line) => {
                  const p = findProduct(line.productId);
                  return (
                    <tr key={line.id} className="border-b border-border/30">
                      <td className="py-3">
                        <div className="text-sm">{p?.name}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{p?.sku}</div>
                      </td>
                      <td className="py-3 font-mono text-xs">{line.dueDate}</td>
                      <td className="py-3 font-mono text-sm">{line.qty} <span className="text-muted-foreground">{p?.uom}</span></td>
                      <td className="py-3 text-right font-mono text-sm">${line.unitPrice.toLocaleString()}</td>
                      <td className="py-3 text-right font-mono text-sm">${(line.qty * line.unitPrice).toLocaleString()}</td>
                      <td className="py-3"><StatusPill status={line.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 text-right text-xs text-muted-foreground">Order total</td>
                  <td className="pt-3 text-right font-mono text-lg font-semibold text-primary">${so.total.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          {so.notes && (
            <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs">
              <span className="text-warning font-medium">Note</span> · {so.notes}
            </div>
          )}
        </Panel>

        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Customer</h3>
          <div className="space-y-3">
            <Field label="Name" value={customer?.name} />
            <Field label="Contact" value={customer?.contact} />
            <Field label="Email" value={customer?.email} />
            <Field label="Phone" value={customer?.phone} mono />
            <Field label="Address" value={customer?.address} />
            <Link to="/customers/$customerId" params={{ customerId: customer?.id ?? "" }} className="mt-2 inline-flex text-xs text-primary hover:underline">View customer →</Link>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Production Orders</h3>
            <span className="text-[11px] text-muted-foreground">{relatedPOs.length} linked</span>
          </div>
          {relatedPOs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No production orders yet.</p>
          ) : (
            <div className="space-y-2">
              {relatedPOs.map(po => {
                const p = findProduct(po.productId);
                return (
                  <Link to="/production-orders/$poId" params={{ poId: po.id }} key={po.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3 hover:border-primary/40">
                    <div>
                      <div className="font-mono text-xs text-primary">{po.number}</div>
                      <div className="text-xs text-muted-foreground">{p?.name} · qty {po.qty}</div>
                    </div>
                    <div className="text-right">
                      <StatusPill status={po.status} />
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">{po.qtyProduced}/{po.qty}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Shipments</h3>
            <span className="text-[11px] text-muted-foreground">{relatedShipments.length} linked</span>
          </div>
          {relatedShipments.length === 0 ? (
            <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground hover:text-foreground">
              <Truck className="h-3.5 w-3.5" /> Create shipment
            </button>
          ) : (
            <div className="space-y-2">
              {relatedShipments.map(s => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
                  <div>
                    <div className="font-mono text-xs text-primary">{s.number}</div>
                    <div className="text-xs text-muted-foreground">{s.carrier} · {s.tracking}</div>
                  </div>
                  <StatusPill status={s.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
