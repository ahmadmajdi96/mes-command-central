import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { customers, salesOrders, findCustomer } from "@/lib/oms-data";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";

export const Route = createFileRoute("/customers/$customerId")({
  head: ({ params }) => ({ meta: [{ title: `${params.customerId} · Customer · CORTA OMS` }] }),
  loader: ({ params }) => {
    const c = findCustomer(params.customerId);
    if (!c) throw notFound();
    return c;
  },
  component: CustomerDetail,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Customer not found.</p>,
});

function CustomerDetail() {
  const c = Route.useLoaderData();
  const orders = salesOrders.filter(s => s.customerId === c.id);
  const total = orders.reduce((s, o) => s + o.total, 0);
  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/customers" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Customers</span></Link>}
        title={c.name}
        subtitle={`${c.contact} · onboarded ${c.createdAt}`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Contact</h3>
          <div className="space-y-3">
            <Field label="Email" value={c.email} />
            <Field label="Phone" value={c.phone} mono />
            <Field label="Address" value={c.address} />
          </div>
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Activity</h3>
          <div className="space-y-3">
            <Field label="Total Orders" value={orders.length} mono />
            <Field label="Lifetime Value" value={`$${total.toLocaleString()}`} mono />
            <Field label="Open Orders" value={orders.filter(o => !["shipped","cancelled"].includes(o.status)).length} mono />
          </div>
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Status</h3>
          <StatusPill status="active" />
        </Panel>
      </div>
      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Orders</h3>
        {orders.length === 0 ? <p className="text-xs text-muted-foreground">No orders yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Order</th>
                  <th className="pb-2 font-medium">Due</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-b border-border/30">
                    <td className="py-3"><Link to="/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-xs text-primary hover:underline">{o.number}</Link></td>
                    <td className="py-3 font-mono text-xs">{o.dueDate}</td>
                    <td className="py-3"><StatusPill status={o.status} /></td>
                    <td className="py-3 text-right font-mono text-sm">${o.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
