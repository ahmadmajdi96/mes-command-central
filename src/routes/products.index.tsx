import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, Package } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { AnalyticsCards } from "@/components/analytics-cards";
import { NewProductDialog } from "@/components/new-product-dialog";
import { toast } from "sonner";
import { useProducts, useCreateProduct, useInventoryTxns, useRealtimeInvalidate, productsKey, productTypeOptions, type Product } from "@/lib/oms-db";
import { useCreateProductRequest, deliverRequestToQc } from "@/lib/product-requests-db";


export const Route = createFileRoute("/products/")({
  head: () => ({ meta: [{ title: "Products · CORTA OMS" }] }),
  component: ProductsList,
});

function ProductsList() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [openNew, setOpenNew] = useState(false);
  useRealtimeInvalidate("products", [productsKey]);

  const { data: products = [], isLoading } = useProducts();
  const { data: txns = [] } = useInventoryTxns();
  const createProduct = useCreateProduct();
  const createRequest = useCreateProductRequest();

  const onHandOf = (id: string) => txns.filter((t) => t.product_id === id).reduce((s, t) => s + Number(t.qty), 0);

  const filtered = useMemo(() => products.filter((p) => {
    if (type !== "all" && p.type !== type) return false;
    if (q) {
      const s = q.toLowerCase();
      return p.sku.toLowerCase().includes(s) || p.name.toLowerCase().includes(s);
    }
    return true;
  }), [q, type, products]);

  const canManage = true;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${products.length}`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="products" rows={filtered}
              columns={[
                { key: "sku", label: "SKU" },
                { key: "name", label: "Name" },
                { key: "type", label: "Type" },
                { key: "uom", label: "UOM" },
                { key: "standard_cost", label: "Std Cost" },
                { key: "lead_time", label: "Lead Time" },
                { key: "onHand", label: "On Hand", get: (p) => onHandOf(p.id) },
              ]}
            />
            {canManage && (
              <button onClick={() => setOpenNew(true)}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
                <Plus className="h-3.5 w-3.5" /> New Product
              </button>
            )}
          </div>
        }
      />

      <SavedPresetsBar<Preset> pageKey="products" current={{ q, type }}
        onApply={(p) => { setQ(p.q ?? ""); setType(p.type ?? "all"); }} />

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKU or name…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1">
          {["all", ...productTypeOptions].map((t) => (
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
        empty={isLoading ? "Loading…" : "No products yet"}
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
          { key: "cost", label: "Std Cost", align: "right", sortAccessor: (p) => Number(p.standard_cost), render: (p) => <span className="font-mono text-sm">${Number(p.standard_cost).toLocaleString()}</span> },
          { key: "onHand", label: "On Hand", align: "right", sortAccessor: (p) => onHandOf(p.id), render: (p) => (
            <span className="font-mono text-sm">{onHandOf(p.id).toLocaleString()}</span>
          )},
        ]}
      />

      <NewProductDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onSubmit={async (v) => {
          const product = await createProduct.mutateAsync({
            sku: v.sku, name: v.name, description: v.description || null,
            uom: v.uom || "EA", type: v.type || "finished",
            standard_cost: v.standard_cost || 0, lead_time: v.lead_time || 0,
            batching_limit: v.batching_limit || 0,
            sale_price: v.sale_price || 0,
          } as never);
          toast.success("Product created");

          if (v.send_to_qc) {
            const steps = v.steps.map((s) => ({
              sequence: s.sequence,
              station_id: s.station_id || null,
              operation: s.operation || null,
              notes: s.notes || null,
            }));

            const req = await createRequest.mutateAsync({
              kind: "new_product",
              direction: "outbound",
              target_system: "CORTA QC System",
              source_system: "CORTA OMS",
              title: `New product: ${product.name} (${product.sku})`,
              description: v.qc_specs || v.description || null,
              product_id: product.id,
              payload: {
                product: {
                  sku: product.sku,
                  name: product.name,
                  description: product.description,
                  category_id: v.qc_category_id || null,
                },
                steps,
                meta: {
                  uom: product.uom,
                  type: product.type,
                  standard_cost: product.standard_cost,
                  lead_time: product.lead_time,
                  qc_specs: v.qc_specs || null,
                },
              } as never,
            });

            toast.success(`Request ${req.number} created — delivering to QC…`);
            deliverRequestToQc(req.id, req.payload).then((res) => {
              if (res.ok) toast.success(`Delivered ${req.number} to QC`);
              else toast.warning(`Request ${req.number} saved — delivery pending (${"error" in res ? res.error : "unknown"})`);
            });
          }
        }}
      />

    </div>
  );
}

