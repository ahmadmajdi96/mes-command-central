import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { useProducts, useInventoryTxns, useRealtimeInvalidate, productsKey } from "@/lib/oms-db";

export const Route = createFileRoute("/products/$productId")({
  head: () => ({ meta: [{ title: `Product · CORTA OMS` }] }),
  component: ProductDetail,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Product not found.</p>,
});

function ProductDetail() {
  const { productId } = Route.useParams();
  useRealtimeInvalidate("products", [productsKey]);
  const { data: products = [], isLoading } = useProducts();
  const { data: txns = [] } = useInventoryTxns();

  const p = products.find((x) => x.id === productId || x.sku === productId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!p) return (
    <div className="glass-panel rounded-2xl p-8 text-center">
      <p className="text-sm text-muted-foreground">Product not found.</p>
      <Link to="/products" className="mt-3 inline-flex text-xs text-primary hover:underline">Back to products</Link>
    </div>
  );

  const inv = txns.filter((t) => t.product_id === p.id);
  const onHand = inv.reduce((s, t) => s + Number(t.qty), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/products" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Products</span></Link>}
        title={p.name}
        subtitle={`${p.sku} · ${p.type} · ${p.uom}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Description</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{(p as any).description ?? "—"}</p>
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Specs</h3>
          <div className="space-y-3">
            <Field label="SKU" value={p.sku} mono />
            <Field label="Type" value={p.type} />
            <Field label="UOM" value={p.uom} mono />
            <Field label="Standard Cost" value={`$${(p as any).standard_cost ?? 0}`} mono />
            <Field label="Batching Limit" value={(p as any).batching_limit ?? "—"} mono />
            <Field label="On Hand" value={onHand.toLocaleString()} mono />
          </div>
        </Panel>
      </div>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Inventory Transactions</h3>
        {inv.length === 0 ? <p className="text-xs text-muted-foreground">No transactions.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {inv.map((t) => (
                <tr key={t.id} className="border-b border-border/30">
                  <td className="py-2 font-mono text-xs">{t.at?.slice(0, 10)}</td>
                  <td className="py-2 text-xs">{t.type}</td>
                  <td className="py-2 text-right font-mono text-sm">{Number(t.qty).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
