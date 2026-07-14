import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Plus, Search, Factory } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { FormDialog } from "@/components/form-dialog";
import { CSVExportButton } from "@/components/csv-export-button";
import { AnalyticsCards } from "@/components/analytics-cards";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useProductionOrders,
  useCreateProductionOrder,
  type ProductionOrder,
  type ProductionOrderStatus,
} from "@/lib/production-orders-db";
import { useProducts, useOrders } from "@/lib/oms-db";

export const Route = createFileRoute("/production-orders/")({
  head: () => ({ meta: [{ title: "Production Orders · CORTA OMS" }] }),
  component: POList,
});

const STATUSES: (ProductionOrderStatus | "all")[] = ["all", "planned", "released", "in_progress", "completed", "cancelled"];

function POList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ProductionOrderStatus | "all">("all");
  const [openNew, setOpenNew] = useState(false);
  const { data: rows = [], isLoading } = useProductionOrders();
  const { data: products = [] } = useProducts();
  const { data: orders = [] } = useOrders();
  const create = useCreateProductionOrder();
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("rt-production-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "production_orders" }, () => {
        qc.invalidateQueries({ queryKey: ["production_orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const productName = (id: string | null) => products.find((p) => p.id === id)?.name ?? "—";
  const soNumber = (id: string | null) => orders.find((o: { id: string; number: string }) => o.id === id)?.number ?? null;

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (q) {
      const s = q.toLowerCase();
      const pName = productName(r.product_id).toLowerCase();
      return (r.number ?? "").toLowerCase().includes(s) || pName.includes(s);
    }
    return true;
  }), [rows, q, status, products]);

  const analytics = useMemo(() => {
    const planned = rows.filter((r) => r.status === "planned").length;
    const released = rows.filter((r) => r.status === "released").length;
    const inProg = rows.filter((r) => r.status === "in_progress").length;
    const completed = rows.filter((r) => r.status === "completed").length;
    const totalQty = rows.reduce((s, r) => s + Number(r.qty ?? 0), 0);
    const produced = rows.reduce((s, r) => s + Number(r.qty_produced ?? 0), 0);
    return [
      { label: "Total POs", value: rows.length, accent: "primary" as const },
      { label: "Planned", value: planned, accent: "info" as const },
      { label: "Released", value: released, accent: "accent" as const },
      { label: "In progress", value: inProg, accent: "warning" as const },
      { label: "Completed", value: completed, accent: "success" as const },
      { label: "Produced / Target", value: `${produced.toLocaleString()}/${totalQty.toLocaleString()}`, accent: "accent" as const },
    ];
  }, [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Production Orders"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${rows.length}`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton filename="production-orders" rows={filtered}
              columns={[
                { key: "number", label: "PO" },
                { key: "status", label: "Status" },
                { key: "qty", label: "Qty" },
                { key: "qty_produced", label: "Produced" },
                { key: "qty_scrap", label: "Scrap" },
                { key: "priority", label: "Priority" },
                { key: "planned_start", label: "Planned Start" },
                { key: "planned_end", label: "Planned End" },
              ]} />
            <button onClick={() => setOpenNew(true)}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
              <Plus className="h-3.5 w-3.5" /> New Production Order
            </button>
          </div>
        }
      />

      <AnalyticsCards cards={analytics} />

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search PO # or product…"
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

      <DataTable<ProductionOrder>
        rows={filtered}
        defaultSort={{ key: "created_at", dir: "desc" }}
        empty={isLoading ? "Loading…" : "No production orders yet"}
        columns={[
          { key: "number", label: "PO", sortAccessor: (r) => r.number ?? "", render: (r) => (
            <Link to="/production-orders/$poId" params={{ poId: r.id }} className="flex items-center gap-2">
              <Factory className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-xs text-primary hover:underline">{r.number}</span>
            </Link>
          )},
          { key: "so", label: "Sales Order", render: (r) => r.sales_order_id ? (
            <Link to="/orders/$orderId" params={{ orderId: r.sales_order_id }} className="font-mono text-xs text-muted-foreground hover:text-primary">{soNumber(r.sales_order_id) ?? r.sales_order_id.slice(0, 8)}</Link>
          ) : <span className="text-xs text-muted-foreground">—</span> },
          { key: "product", label: "Product", render: (r) => <span className="text-sm">{productName(r.product_id)}</span> },
          { key: "qty", label: "Qty", align: "right", render: (r) => <span className="font-mono text-sm">{Number(r.qty_produced)}/{Number(r.qty)}</span> },
          { key: "scrap", label: "Scrap", align: "right", render: (r) => <span className="font-mono text-xs text-warning">{Number(r.qty_scrap)}</span> },
          { key: "planned", label: "Planned", render: (r) => <span className="font-mono text-xs">{r.planned_start ?? "—"} → {r.planned_end ?? "—"}</span> },
          { key: "prio", label: "Prio", align: "right", render: (r) => (
            <span className={`font-mono text-xs ${r.priority >= 3 ? "text-destructive" : r.priority === 2 ? "text-warning" : "text-muted-foreground"}`}>P{r.priority}</span>
          )},
          { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
        ]}
      />

      <FormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        title="New Production Order"
        submitLabel="Create"
        fields={[
          { name: "product_id", label: "Product", required: true, type: "select",
            options: products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })) },
          { name: "sales_order_id", label: "Sales Order (optional)", type: "select",
            options: orders.map((o: { id: string; number: string }) => ({ value: o.id, label: o.number })) },
          { name: "qty", label: "Quantity", type: "number", required: true, step: 1 },
          { name: "priority", label: "Priority (1-5)", type: "number", step: 1 },
          { name: "planned_start", label: "Planned start", type: "date" },
          { name: "planned_end", label: "Planned end", type: "date" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v: Record<string, unknown>) => {
          const created = await create.mutateAsync({
            product_id: (v.product_id as string) || null,
            sales_order_id: (v.sales_order_id as string) || null,
            qty: Number(v.qty) || 0,
            priority: Number(v.priority) || 3,
            planned_start: (v.planned_start as string) || null,
            planned_end: (v.planned_end as string) || null,
            notes: (v.notes as string) || null,
          });
          toast.success(`Created ${created.number}`);
        }}
      />
    </div>
  );
}
