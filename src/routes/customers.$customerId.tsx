import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCustomers, useOrders, useUpdateCustomer, useDeleteCustomer, useRealtimeInvalidate, customersKey } from "@/lib/oms-db";

export const Route = createFileRoute("/customers/$customerId")({
  head: () => ({ meta: [{ title: `Customer · OMS` }] }),
  component: CustomerDetail,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Customer not found.</p>,
});

function CustomerDetail() {
  const { customerId } = Route.useParams();
  const navigate = useNavigate();
  useRealtimeInvalidate("customers", [customersKey]);
  const { data: customers = [], isLoading } = useCustomers();
  const { data: orders = [] } = useOrders();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const c = customers.find((x) => x.id === customerId || x.code === customerId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!c) return (
    <div className="glass-panel rounded-2xl p-8 text-center">
      <p className="text-sm text-muted-foreground">Customer not found.</p>
      <Link to="/customers" className="mt-3 inline-flex text-xs text-primary hover:underline">Back to customers</Link>
    </div>
  );

  const custOrders = orders.filter((o) => o.customer_id === c.id);
  const total = custOrders.reduce((s, o) => s + Number(o.total ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/customers" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Customers</span></Link>}
        title={c.name}
        subtitle={`${c.contact ?? "—"} · ${c.code ?? ""}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card">
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Contact</h3>
          <div className="space-y-3">
            <Field label="Email" value={c.email ?? "—"} />
            <Field label="Phone" value={c.phone ?? "—"} mono />
            <Field label="Address" value={c.address ?? "—"} />
          </div>
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Activity</h3>
          <div className="space-y-3">
            <Field label="Total Orders" value={custOrders.length} mono />
            <Field label="Lifetime Value" value={`$${total.toLocaleString()}`} mono />
            <Field label="Open Orders" value={custOrders.filter(o => !["shipped","cancelled"].includes(o.status)).length} mono />
          </div>
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Status</h3>
          <StatusPill status="active" />
        </Panel>
      </div>
      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Orders</h3>
        {custOrders.length === 0 ? <p className="text-xs text-muted-foreground">No orders yet.</p> : (
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
                {custOrders.map(o => (
                  <tr key={o.id} className="border-b border-border/30">
                    <td className="py-3"><Link to="/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-xs text-primary hover:underline">{o.number}</Link></td>
                    <td className="py-3 font-mono text-xs">{o.due_date ?? "—"}</td>
                    <td className="py-3"><StatusPill status={o.status} /></td>
                    <td className="py-3 text-right font-mono text-sm">${Number(o.total ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <FormDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit customer"
        submitLabel="Save"
        initial={{ name: c.name, contact: c.contact ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "" }}
        fields={[
          { name: "name", label: "Name", required: true },
          { name: "contact", label: "Contact" },
          { name: "email", label: "Email", type: "email" },
          { name: "phone", label: "Phone" },
          { name: "address", label: "Address", type: "textarea" },
        ]}
        onSubmit={async (v: { name: string; contact?: string; email?: string; phone?: string; address?: string }) => {
          await updateCustomer.mutateAsync({ id: c.id, patch: {
            name: v.name,
            contact: v.contact || null,
            email: v.email || null,
            phone: v.phone || null,
            address: v.address || null,
          }});
          toast.success("Customer updated");
        }}
      />

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title="Delete customer"
        description={`Delete ${c.name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          await deleteCustomer.mutateAsync(c.id);
          toast.success("Customer deleted");
          navigate({ to: "/customers" });
        }}
      />
    </div>
  );
}
