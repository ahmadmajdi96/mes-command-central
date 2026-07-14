import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Trash2, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useReturn, useReturnLines, useRefunds, useUpdateReturn, useDeleteReturn,
  useCreateReturnLine, useDeleteReturnLine, useCreateRefund, useReorderFromReturn,
} from "@/lib/returns-db";
import { useOrders, useProducts } from "@/lib/oms-db";

export const Route = createFileRoute("/returns/$returnId")({
  head: () => ({ meta: [{ title: "Return · OMS" }] }),
  component: ReturnDetail,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Return not found.</p>,
});

function ReturnDetail() {
  const { returnId } = Route.useParams();
  const navigate = useNavigate();
  const { data: ret, isLoading } = useReturn(returnId);
  const { data: lines = [] } = useReturnLines(returnId);
  const { data: refunds = [] } = useRefunds(returnId);
  const { data: orders = [] } = useOrders();
  const { data: products = [] } = useProducts();

  const updateReturn = useUpdateReturn();
  const deleteReturn = useDeleteReturn();
  const createLine = useCreateReturnLine(returnId);
  const deleteLine = useDeleteReturnLine(returnId);
  const createRefund = useCreateRefund(returnId);
  const reorder = useReorderFromReturn();

  const [addLine, setAddLine] = useState(false);
  const [addRefund, setAddRefund] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!ret) return <p className="text-sm text-muted-foreground">Return not found.</p>;

  const order = orders.find((o) => o.id === ret.order_id);
  const reorderOrder = orders.find((o) => o.id === ret.reorder_order_id);
  const totalRefund = refunds.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const totalLine = lines.reduce((s, l) => s + Number(l.qty ?? 0) * Number(l.unit_price ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/returns" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Returns</span></Link>}
        title={ret.number}
        subtitle={order ? `Order ${order.number}` : "—"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={ret.status} />
            {ret.status === "requested" && (
              <>
                <button onClick={() => updateReturn.mutate({ id: ret.id, patch: { status: "approved" } })} className="rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs text-info hover:bg-info/20">Approve</button>
                <button onClick={() => updateReturn.mutate({ id: ret.id, patch: { status: "rejected" } })} className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20">Reject</button>
              </>
            )}
            {(ret.status === "approved" || ret.status === "refunded") && (
              <button onClick={() => setAddRefund(true)} className="rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs text-success hover:bg-success/20">Add refund</button>
            )}
            {order && !ret.reorder_order_id && (ret.status === "approved" || ret.status === "refunded" || ret.status === "closed") && (
              <button
                onClick={() => reorder.mutate({ returnId: ret.id, orderId: ret.order_id }, {
                  onSuccess: (r) => navigate({ to: "/orders/$orderId", params: { orderId: r.id } }),
                })}
                className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20"
              >
                <RotateCw className="h-3 w-3" /> Re-order
              </button>
            )}
            <button onClick={() => setEditing(true)} className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card">Edit</button>
            <button onClick={() => setConfirmDel(true)} className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10">Delete</button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Return</h3>
          <div className="space-y-3">
            <Field label="Reason" value={ret.reason ?? "—"} />
            <Field label="Notes" value={ret.notes ?? "—"} />
            <Field label="Line total" value={`$${totalLine.toLocaleString()}`} mono />
            <Field label="Refunded" value={`$${totalRefund.toLocaleString()}`} mono />
          </div>
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Order</h3>
          <div className="space-y-3">
            <Field label="Original" value={order ? <Link to="/orders/$orderId" params={{ orderId: order.id }} className="text-primary hover:underline">{order.number}</Link> : "—"} />
            <Field label="Re-order" value={reorderOrder ? <Link to="/orders/$orderId" params={{ orderId: reorderOrder.id }} className="text-primary hover:underline">{reorderOrder.number}</Link> : "—"} />
          </div>
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Status</h3>
          <div className="space-y-2 text-xs">
            <div>Created: <span className="font-mono">{ret.created_at.slice(0, 16).replace("T", " ")}</span></div>
            <div>Updated: <span className="font-mono">{ret.updated_at.slice(0, 16).replace("T", " ")}</span></div>
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Return lines</h3>
          <button onClick={() => setAddLine(true)} className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/60 px-2.5 py-1 text-[11px] hover:bg-card">
            <Plus className="h-3 w-3" /> Add line
          </button>
        </div>
        {lines.length === 0 ? (
          <p className="text-xs text-muted-foreground">No lines yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium">Qty</th>
                <th className="pb-2 font-medium">Unit</th>
                <th className="pb-2 font-medium">Reason</th>
                <th className="pb-2 font-medium text-right">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const p = products.find((x) => x.id === l.product_id);
                return (
                  <tr key={l.id} className="border-b border-border/30">
                    <td className="py-2 text-xs">{p ? `${p.sku} · ${p.name}` : "—"}</td>
                    <td className="py-2 font-mono text-xs">{l.qty}</td>
                    <td className="py-2 font-mono text-xs">${Number(l.unit_price).toFixed(2)}</td>
                    <td className="py-2 text-xs">{l.reason ?? "—"}</td>
                    <td className="py-2 text-right font-mono text-xs">${(Number(l.qty) * Number(l.unit_price)).toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => deleteLine.mutate(l.id)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Refunds</h3>
        {refunds.length === 0 ? (
          <p className="text-xs text-muted-foreground">No refunds yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Method</th>
                <th className="pb-2 font-medium">Reference</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id} className="border-b border-border/30">
                  <td className="py-2 font-mono text-xs text-muted-foreground">{r.created_at.slice(0, 10)}</td>
                  <td className="py-2 font-mono text-xs">${Number(r.amount).toFixed(2)} {r.currency}</td>
                  <td className="py-2 text-xs">{r.method ?? "—"}</td>
                  <td className="py-2 font-mono text-xs">{r.reference ?? "—"}</td>
                  <td className="py-2"><StatusPill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <FormDialog
        open={addLine}
        onOpenChange={setAddLine}
        title="Add return line"
        submitLabel="Add"
        fields={[
          { name: "product_id", label: "Product", type: "select", required: true, options: products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` })) },
          { name: "qty", label: "Qty", type: "number", required: true, step: 1 },
          { name: "unit_price", label: "Unit price", type: "number", step: 0.01 },
          { name: "reason", label: "Reason" },
        ]}
        onSubmit={async (v: { product_id: string; qty: number; unit_price: number; reason?: string }) => {
          await createLine.mutateAsync({ product_id: v.product_id, qty: Number(v.qty), unit_price: Number(v.unit_price ?? 0), reason: v.reason ?? null });
        }}
      />

      <FormDialog
        open={addRefund}
        onOpenChange={setAddRefund}
        title="Record refund"
        submitLabel="Save refund"
        fields={[
          { name: "amount", label: "Amount", type: "number", required: true, step: 0.01 },
          { name: "currency", label: "Currency" },
          { name: "method", label: "Method", type: "select", options: [
            { value: "cash", label: "Cash" },
            { value: "card", label: "Card" },
            { value: "bank_transfer", label: "Bank transfer" },
            { value: "store_credit", label: "Store credit" },
          ]},
          { name: "reference", label: "Reference" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v: { amount: number; currency?: string; method?: string; reference?: string; notes?: string }) => {
          await createRefund.mutateAsync({
            amount: Number(v.amount),
            currency: v.currency || "USD",
            method: v.method,
            reference: v.reference,
            notes: v.notes,
          });
        }}
      />

      <FormDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit return"
        submitLabel="Save"
        initial={{ status: ret.status, reason: ret.reason ?? "", notes: ret.notes ?? "" }}
        fields={[
          { name: "status", label: "Status", type: "select", required: true, options: ["requested","approved","rejected","refunded","closed"].map((s) => ({ value: s, label: s })) },
          { name: "reason", label: "Reason" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v: { status: string; reason?: string; notes?: string }) => {
          await updateReturn.mutateAsync({ id: ret.id, patch: { status: v.status as never, reason: v.reason ?? null, notes: v.notes ?? null } });
          toast.success("Return updated");
        }}
      />

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title="Delete return"
        description={`Delete ${ret.number}? This also removes its lines and refunds.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteReturn.mutateAsync(ret.id);
          navigate({ to: "/returns" });
        }}
      />
    </div>
  );
}
