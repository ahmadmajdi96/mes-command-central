import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Play, XCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { PageHeader, Panel, Field, DataTable } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useProductionOrder,
  useUpdateProductionOrder,
  useDeleteProductionOrder,
  type ProductionOrder,
} from "@/lib/production-orders-db";
import { useBatches, useCreateBatch, useUpdateBatch, useDeleteBatch, type Batch } from "@/lib/batches-db";
import { useProducts, useSalesOrders } from "@/lib/oms-db";

export const Route = createFileRoute("/production-orders/$poId")({
  head: ({ params }) => ({ meta: [{ title: `PO ${params.poId.slice(0, 8)} · CORTA OMS` }] }),
  component: PODetail,
  errorComponent: ({ error }) => <div className="glass-panel rounded-2xl p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">Production order not found.</div>,
});

function PODetail() {
  const { poId } = Route.useParams();
  const router = useRouter();
  const po = useProductionOrder(poId);
  const upd = useUpdateProductionOrder();
  const del = useDeleteProductionOrder();
  const { data: products = [] } = useProducts();
  const { data: orders = [] } = useSalesOrders();
  const { data: batches = [] } = useBatches(poId);
  const createBatch = useCreateBatch();
  const updBatch = useUpdateBatch();
  const delBatch = useDeleteBatch();
  const [openBatch, setOpenBatch] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel(`rt-po-${poId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "production_orders", filter: `id=eq.${poId}` }, () => po.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "batches", filter: `production_order_id=eq.${poId}` }, () => po.refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poId]);

  if (po.isLoading) return <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!po.data) throw notFound();
  const r: ProductionOrder = po.data;
  const product = products.find((p) => p.id === r.product_id);
  const so = orders.find((o) => o.id === r.sales_order_id);
  const pct = Number(r.qty) > 0 ? Math.round((Number(r.qty_produced) / Number(r.qty)) * 100) : 0;

  const transition = async (status: ProductionOrder["status"]) => {
    const patch: Partial<ProductionOrder> = { status };
    if (status === "in_progress" && !r.actual_start) patch.actual_start = new Date().toISOString();
    if (status === "completed") patch.actual_end = new Date().toISOString();
    await upd.mutateAsync({ id: r.id, patch });
    toast.success(`Status → ${status}`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/production-orders" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Production Orders</span></Link>}
        title={r.number ?? "Untitled PO"}
        subtitle={`${product?.name ?? "—"} · qty ${Number(r.qty)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={r.status} />
            {r.status === "planned" && (
              <button onClick={() => transition("released")} className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Play className="h-3.5 w-3.5" /> Release
              </button>
            )}
            {r.status === "released" && (
              <button onClick={() => transition("in_progress")} className="flex items-center gap-1.5 rounded-lg border border-info/40 bg-info/10 px-3 py-1.5 text-xs font-medium text-info">
                <Play className="h-3.5 w-3.5" /> Start
              </button>
            )}
            {r.status === "in_progress" && (
              <button onClick={() => transition("completed")} className="flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> Complete
              </button>
            )}
            {r.status !== "completed" && r.status !== "cancelled" && (
              <button onClick={() => transition("cancelled")} className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </button>
            )}
            <button onClick={() => setConfirmDel(true)} className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              Delete
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel className="lg:col-span-3">
          <h3 className="mb-3 text-sm font-semibold">Progress</h3>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-3xl font-semibold text-glow">
              {Number(r.qty_produced)}<span className="text-lg text-muted-foreground"> / {Number(r.qty)}</span>
            </span>
            <span className="text-xs text-muted-foreground">{pct}% complete · {Number(r.qty_scrap)} scrap</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-info" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Planned Start" value={r.planned_start ?? "—"} mono />
            <Field label="Planned End" value={r.planned_end ?? "—"} mono />
            <Field label="Actual Start" value={r.actual_start ? new Date(r.actual_start).toLocaleString() : "—"} mono />
            <Field label="Actual End" value={r.actual_end ? new Date(r.actual_end).toLocaleString() : "—"} mono />
            <Field label="Priority" value={`P${r.priority}`} mono />
            <Field label="Batches" value={batches.length} mono />
          </div>
          {r.notes && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{r.notes}</p>
            </div>
          )}
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Linked</h3>
          <div className="space-y-3">
            {so ? (
              <Field label="Sales Order" value={<Link to="/orders/$orderId" params={{ orderId: so.id }} className="text-primary hover:underline">{so.number}</Link>} />
            ) : <p className="text-xs text-muted-foreground">Make-to-stock (no SO)</p>}
            <Field label="Product" value={<span>{product?.name ?? "—"}<div className="font-mono text-[11px] text-muted-foreground">{product?.sku}</div></span>} />
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Batches ({batches.length})</h3>
          <button onClick={() => { setEditBatch(null); setOpenBatch(true); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
            <Plus className="h-3.5 w-3.5" /> New Batch
          </button>
        </div>
        <DataTable<Batch>
          rows={batches}
          empty="No batches yet. Split this production order into batches to track lots."
          columns={[
            { key: "number", label: "Batch", render: (b) => (
              <Link to="/batches/$batchId" params={{ batchId: b.id }} className="font-mono text-xs text-primary hover:underline">{b.number}</Link>
            )},
            { key: "lot", label: "Lot", render: (b) => <span className="font-mono text-xs">{b.lot_code ?? "—"}</span> },
            { key: "qty", label: "Qty", align: "right", render: (b) => <span className="font-mono text-sm">{Number(b.qty_good)}/{Number(b.qty)}</span> },
            { key: "scrap", label: "Scrap", align: "right", render: (b) => <span className="font-mono text-xs text-warning">{Number(b.qty_scrap)}</span> },
            { key: "expiry", label: "Expiry", render: (b) => <span className="font-mono text-xs">{b.expiry_date ?? "—"}</span> },
            { key: "status", label: "Status", render: (b) => <StatusPill status={b.status} /> },
            { key: "actions", label: "", align: "right", render: (b) => (
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => { setEditBatch(b); setOpenBatch(true); }} className="rounded-md border border-border/60 px-2 py-1 text-[10px] hover:text-primary hover:border-primary/40">Edit</button>
                <button onClick={async () => { if (confirm(`Delete ${b.number}?`)) { await delBatch.mutateAsync(b.id); toast.success("Batch deleted"); } }}
                  className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            )},
          ]}
        />
      </Panel>

      <FormDialog
        open={openBatch}
        onOpenChange={setOpenBatch}
        title={editBatch ? `Edit ${editBatch.number}` : "New Batch"}
        submitLabel={editBatch ? "Save" : "Create"}
        initial={editBatch ?? undefined}
        fields={[
          { name: "lot_code", label: "Lot code", placeholder: "LOT-001" },
          { name: "qty", label: "Planned qty", type: "number", required: true, step: 1 },
          { name: "qty_good", label: "Good qty", type: "number", step: 1 },
          { name: "qty_scrap", label: "Scrap qty", type: "number", step: 1 },
          { name: "expiry_date", label: "Expiry date", type: "date" },
          { name: "status", label: "Status", type: "select",
            options: ["planned","in_progress","on_hold","released","completed","rejected"].map((s) => ({ value: s, label: s.replace("_"," ") })) },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v: Record<string, unknown>) => {
          const patch = {
            lot_code: (v.lot_code as string) || null,
            qty: Number(v.qty) || 0,
            qty_good: Number(v.qty_good) || 0,
            qty_scrap: Number(v.qty_scrap) || 0,
            expiry_date: (v.expiry_date as string) || null,
            status: ((v.status as string) || "planned") as Batch["status"],
            notes: (v.notes as string) || null,
          };
          if (editBatch) {
            await updBatch.mutateAsync({ id: editBatch.id, patch });
            toast.success("Batch updated");
          } else {
            await createBatch.mutateAsync({
              ...patch,
              production_order_id: r.id,
              product_id: r.product_id,
            });
            toast.success("Batch created");
          }
        }}
      />

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title={`Delete ${r.number}?`}
        description="This will remove the production order and unlink its batches."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          await del.mutateAsync(r.id);
          toast.success("Deleted");
          router.navigate({ to: "/production-orders" });
        }}
      />
    </div>
  );
}
