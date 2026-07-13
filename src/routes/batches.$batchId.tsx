import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBatch, useUpdateBatch, useDeleteBatch, type Batch } from "@/lib/batches-db";
import { useProducts } from "@/lib/oms-db";
import { useProductionOrders } from "@/lib/production-orders-db";

export const Route = createFileRoute("/batches/$batchId")({
  head: ({ params }) => ({ meta: [{ title: `Batch ${params.batchId.slice(0, 8)} · CORTA OMS` }] }),
  component: BatchDetail,
  errorComponent: ({ error }) => <div className="glass-panel rounded-2xl p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">Batch not found.</div>,
});

function BatchDetail() {
  const { batchId } = Route.useParams();
  const router = useRouter();
  const q = useBatch(batchId);
  const upd = useUpdateBatch();
  const del = useDeleteBatch();
  const { data: products = [] } = useProducts();
  const { data: pos = [] } = useProductionOrders();
  const [openEdit, setOpenEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    const ch = supabase
      .channel(`rt-batch-${batchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "batches", filter: `id=eq.${batchId}` }, () => q.refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  if (q.isLoading) return <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!q.data) throw notFound();
  const b: Batch = q.data;
  const product = products.find((p) => p.id === b.product_id);
  const po = pos.find((p) => p.id === b.production_order_id);
  const pct = Number(b.qty) > 0 ? Math.round((Number(b.qty_good) / Number(b.qty)) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/batches" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Batches</span></Link>}
        title={b.number ?? "Batch"}
        subtitle={`${product?.name ?? "—"}${b.lot_code ? ` · lot ${b.lot_code}` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={b.status} />
            <button onClick={() => setOpenEdit(true)} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">Edit</button>
            <button onClick={() => setConfirmDel(true)} className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              <Trash2 className="mr-1 inline h-3 w-3" /> Delete
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel className="lg:col-span-3">
          <h3 className="mb-3 text-sm font-semibold">Progress</h3>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-3xl font-semibold text-glow">
              {Number(b.qty_good)}<span className="text-lg text-muted-foreground"> / {Number(b.qty)}</span>
            </span>
            <span className="text-xs text-muted-foreground">{pct}% good · {Number(b.qty_scrap)} scrap</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-success to-info" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Lot Code" value={b.lot_code ?? "—"} mono />
            <Field label="Expiry" value={b.expiry_date ?? "—"} mono />
            <Field label="Started" value={b.started_at ? new Date(b.started_at).toLocaleString() : "—"} mono />
            <Field label="Completed" value={b.completed_at ? new Date(b.completed_at).toLocaleString() : "—"} mono />
          </div>
          {b.notes && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{b.notes}</p>
            </div>
          )}
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Linked</h3>
          <div className="space-y-3">
            <Field label="Product" value={<span>{product?.name ?? "—"}<div className="font-mono text-[11px] text-muted-foreground">{product?.sku}</div></span>} />
            {po ? (
              <Field label="Production Order" value={<Link to="/production-orders/$poId" params={{ poId: po.id }} className="text-primary hover:underline">{po.number}</Link>} />
            ) : <p className="text-xs text-muted-foreground">Standalone batch</p>}
            <Field label="Created" value={new Date(b.created_at).toLocaleString()} mono />
          </div>
        </Panel>
      </div>

      <FormDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        title={`Edit ${b.number}`}
        submitLabel="Save"
        initial={b}
        fields={[
          { name: "lot_code", label: "Lot code" },
          { name: "qty", label: "Planned qty", type: "number", step: 1 },
          { name: "qty_good", label: "Good qty", type: "number", step: 1 },
          { name: "qty_scrap", label: "Scrap qty", type: "number", step: 1 },
          { name: "expiry_date", label: "Expiry date", type: "date" },
          { name: "status", label: "Status", type: "select",
            options: ["planned","in_progress","on_hold","released","completed","rejected"].map((s) => ({ value: s, label: s.replace("_"," ") })) },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v: Record<string, unknown>) => {
          await upd.mutateAsync({
            id: b.id,
            patch: {
              lot_code: (v.lot_code as string) || null,
              qty: Number(v.qty) || 0,
              qty_good: Number(v.qty_good) || 0,
              qty_scrap: Number(v.qty_scrap) || 0,
              expiry_date: (v.expiry_date as string) || null,
              status: ((v.status as string) || b.status) as Batch["status"],
              notes: (v.notes as string) || null,
            },
          });
          toast.success("Batch updated");
        }}
      />

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title={`Delete ${b.number}?`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          await del.mutateAsync(b.id);
          toast.success("Batch deleted");
          router.navigate({ to: "/batches" });
        }}
      />
    </div>
  );
}
