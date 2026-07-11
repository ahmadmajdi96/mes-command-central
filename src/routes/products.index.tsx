import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, Package } from "lucide-react";
import { products, inventory, type Product } from "@/lib/oms-data";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";

export const Route = createFileRoute("/products/")({
  head: () => ({ meta: [{ title: "Products · CORTA OMS" }] }),
  component: ProductsList,
});

const onHandOf = (id: string) => inventory.filter((i) => i.productId === id).reduce((s, i) => s + i.qty, 0);

function ProductsList() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const filtered = useMemo(() => products.filter(p => {
    if (type !== "all" && p.type !== type) return false;
    if (q) return p.sku.toLowerCase().includes(q.toLowerCase()) || p.name.toLowerCase().includes(q.toLowerCase());
    return true;
  }), [q, type]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        subtitle={`${filtered.length} of ${products.length}`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="products"
              rows={filtered}
              columns={[
                { key: "sku", label: "SKU" },
                { key: "name", label: "Name" },
                { key: "type", label: "Type" },
                { key: "uom", label: "UOM" },
                { key: "standardCost", label: "Std Cost" },
                { key: "leadTime", label: "Lead Time" },
                { key: "onHand", label: "On Hand", get: (p) => onHandOf(p.id) },
              ]}
            />
            <button className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Plus className="h-3.5 w-3.5" /> New Product
            </button>
          </div>
        }
      />
      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU or name…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1">
          {["all", "finished", "semi", "raw"].map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${type === t ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <DataTable<Product>
        rows={filtered}
        defaultSort={{ key: "sku", dir: "asc" }}
        columns={[
          { key: "sku", label: "SKU", sortAccessor: (p) => p.sku, render: (p) => (
            <Link to="/products/$productId" params={{ productId: p.id }} className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-xs text-primary hover:underline">{p.sku}</span>
            </Link>
          )},
          { key: "name", label: "Name", sortAccessor: (p) => p.name, render: (p) => <span className="text-sm">{p.name}</span> },
          { key: "type", label: "Type", sortAccessor: (p) => p.type, render: (p) => <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{p.type}</span> },
          { key: "uom", label: "UOM", render: (p) => <span className="font-mono text-xs">{p.uom}</span> },
          { key: "cost", label: "Std Cost", align: "right", sortAccessor: (p) => p.standardCost, render: (p) => <span className="font-mono text-sm">${p.standardCost.toLocaleString()}</span> },
          { key: "onHand", label: "On Hand", align: "right", sortAccessor: (p) => onHandOf(p.id), render: (p) => (
            <span className="font-mono text-sm">{onHandOf(p.id).toLocaleString()}</span>
          )},
        ]}
      />
    </div>
  );
}
