import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Plus, Search, Boxes } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { FormDialog } from "@/components/form-dialog";
import { CSVExportButton } from "@/components/csv-export-button";
import { AnalyticsCards } from "@/components/analytics-cards";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useBatches, useCreateBatch, type Batch, type BatchStatus } from "@/lib/batches-db";
import { useProducts } from "@/lib/oms-db";
import { useProductionOrders } from "@/lib/production-orders-db";

export const Route = createFileRoute("/batches/")({
  head: () => ({ meta: [{ title: "Batches · CORTA OMS" }] }),
  component: BatchList,
});

const STATUSES: (BatchStatus | "all")[] = ["all", "planned", "in_progress", "on_hold", "released", "completed", "rejected"];

function BatchList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BatchStatus | "all">("all");
  const [openNew, setOpenNew] = useState(false);
  const { data: rows = [], isLoading } = useBatches();
  const { data: products = [] } = useProducts();
  const { data: pos = [] } = useProductionOrders();
  const create = useCreateBatch();
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("rt-batches")
      .on("postgres_changes", { event: "*", schema: "public", table: "batches" }, () => {
        qc.invalidateQueries({ queryKey: ["batches"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";
  const poNumber = (id: string | null) => pos.find((p) => p.id === id)?.number ?? null;

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (q) {
      const s = q.toLowerCase();
      return (r.number ?? "").toLowerCase().includes(s) || (r.lot_code ?? "").toLowerCase().includes(s) || productName(r.product_id).toLowerCase().includes(s);
    }
    return true;
  }), [rows, q, status, products]);

  const analytics = useMemo(() => {
    const planned = rows.filter((r) => r.status === "planned").length;
    const inProg = rows.filter((r) => r.status === "in_progress").length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const rejected = rows.filter((r) => r.status === "rejected").length;
    const totalQty = rows.reduce((s, r) => s + Number(r.qty ?? 0), 0);
    const totalScrap = rows.reduce((s, r) => s + Number(r.qty_scrap ?? 0), 0);
    return [
      { label: "Total batches", value: rows.length, accent: "primary" as const },
      { label: "Planned", value: planned, accent: "info" as const },
      { label: "In progress", value: inProg, accent: "warning" as const },
      { label: "Completed", value: completed, accent: "success" as const },
      { label: "Rejected", value: rejected, accent: "destructive" as const },
      { label: "Qty / Scrap", value: totalQty.toLocaleString(), hint: `${totalScrap.toLocaleString()} scrap`, accent: "accent" as const },
    ];
  }, [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Batches"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${rows.length}`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton filename="batches" rows={filtered}
              columns={[
                { key: "number", label: "Batch" },
                { key: "lot_code", label: "Lot" },
                { key: "status", label: "Status" },
                { key: "qty", label: "Qty" },
                { key: "qty_good", label: "Good" },
                { key: "qty_scrap", label: "Scrap" },
                { key: "expiry_date", label: "Expiry" },
              ]} />
            <button onClick={() => setOpenNew(true)}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
              <Plus className="h-3.5 w-3.5" /> New Batch
            </button>
          </div>
        }
      />

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search batch #, lot, product…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${status === s ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <DataTable<Batch>
        rows={filtered}
        defaultSort={{ key: "created_at", dir: "desc" }}
        empty={isLoading ? "Loading…" : "No batches yet"}
        columns={[
          { key: "number", label: "Batch", render: (b) => (
            <Link to="/batches/$batchId" params={{ batchId: b.id }} className="flex items-center gap-2">
              <Boxes className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-xs text-primary hover:underline">{b.number}</span>
            </Link>
          )},
          { key: "lot", label: "Lot", render: (b) => <span className="font-mono text-xs">{b.lot_code ?? "—"}</span> },
          { key: "product", label: "Product", render: (b) => <span className="text-sm">{productName(b.product_id)}</span> },
          { key: "po", label: "PO", render: (b) => b.production_order_id ? (
            <Link to="/production-orders/$poId" params={{ poId: b.production_order_id }} className="font-mono text-xs text-muted-foreground hover:text-primary">{poNumber(b.production_order_id) ?? b.production_order_id.slice(0, 8)}</Link>
          ) : <span className="text-xs text-muted-foreground">—</span> },
          { key: "qty", label: "Qty", align: "right", render: (b) => <span className="font-mono text-sm">{Number(b.qty_good)}/{Number(b.qty)}</span> },
          { key: "scrap", label: "Scrap", align: "right", render: (b) => <span className="font-mono text-xs text-warning">{Number(b.qty_scrap)}</span> },
          { key: "expiry", label: "Expiry", render: (b) => <span className="font-mono text-xs">{b.expiry_date ?? "—"}</span> },
          { key: "status", label: "Status", render: (b) => <StatusPill status={b.status} /> },
        ]}
      />

      <FormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        title="New Batch"
        submitLabel="Create"
        fields={[
          { name: "product_id", label: "Product", required: true, type: "select",
            options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })) },
          { name: "production_order_id", label: "Production Order (optional)", type: "select",
            options: pos.map((p) => ({ value: p.id, label: p.number ?? p.id.slice(0, 8) })) },
          { name: "lot_code", label: "Lot code", placeholder: "LOT-001" },
          { name: "qty", label: "Planned quantity", type: "number", required: true, step: 1 },
          { name: "expiry_date", label: "Expiry date", type: "date" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v: Record<string, unknown>) => {
          const created = await create.mutateAsync({
            product_id: (v.product_id as string) || null,
            production_order_id: (v.production_order_id as string) || null,
            lot_code: (v.lot_code as string) || null,
            qty: Number(v.qty) || 0,
            expiry_date: (v.expiry_date as string) || null,
            notes: (v.notes as string) || null,
          });
          toast.success(`Created ${created.number}`);
        }}
      />
    </div>
  );
}
