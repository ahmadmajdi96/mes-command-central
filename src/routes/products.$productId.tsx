import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  findProduct, boms, routings, findWorkstation, inventory,
} from "@/lib/oms-data";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { useState } from "react";

export const Route = createFileRoute("/products/$productId")({
  head: ({ params }) => ({ meta: [{ title: `${params.productId} · Product · CORTA OMS` }] }),
  loader: ({ params }) => {
    const p = findProduct(params.productId);
    if (!p) throw notFound();
    return p;
  },
  component: ProductDetail,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Product not found.</p>,
});

function ProductDetail() {
  const p = Route.useLoaderData();
  const [tab, setTab] = useState<"details" | "bom" | "routing" | "inventory">("details");
  const bom = boms[p.id] ?? [];
  const routing = routings[p.id] ?? [];
  const inv = inventory.filter(i => i.productId === p.id);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/products" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Products</span></Link>}
        title={p.name}
        subtitle={`${p.sku} · ${p.type} · ${p.uom}`}
      />
      <div className="flex gap-1 border-b border-border/60">
        {[
          { k: "details", l: "Details" },
          { k: "bom", l: `BOM (${bom.length})` },
          { k: "routing", l: `Routing (${routing.length})` },
          { k: "inventory", l: "Inventory" },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as typeof tab)}
            className={`border-b-2 px-4 py-2 text-xs font-medium ${tab === t.k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <h3 className="mb-3 text-sm font-semibold">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
          </Panel>
          <Panel>
            <h3 className="mb-3 text-sm font-semibold">Specs</h3>
            <div className="space-y-3">
              <Field label="SKU" value={p.sku} mono />
              <Field label="Type" value={p.type} />
              <Field label="UOM" value={p.uom} mono />
              <Field label="Standard Cost" value={`$${p.standardCost}`} mono />
              <Field label="Lead Time" value={`${p.leadTime} days`} mono />
            </div>
          </Panel>
        </div>
      )}

      {tab === "bom" && (
        <Panel>
          {bom.length === 0 ? <p className="text-xs text-muted-foreground">No components.</p> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Component</th>
                  <th className="pb-2 font-medium text-right">Qty</th>
                  <th className="pb-2 font-medium text-right">Scrap %</th>
                </tr>
              </thead>
              <tbody>
                {bom.map((b, i) => {
                  const c = findProduct(b.componentId);
                  return (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-2">
                        <Link to="/products/$productId" params={{ productId: b.componentId }} className="text-sm text-primary hover:underline">{c?.name}</Link>
                        <div className="font-mono text-[11px] text-muted-foreground">{c?.sku}</div>
                      </td>
                      <td className="py-2 text-right font-mono text-sm">{b.qty} {c?.uom}</td>
                      <td className="py-2 text-right font-mono text-xs text-warning">{b.scrapPct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {tab === "routing" && (
        <Panel>
          {routing.length === 0 ? <p className="text-xs text-muted-foreground">No routing.</p> : (
            <div className="space-y-2">
              {routing.map(r => (
                <div key={r.seq} className="rounded-xl border border-border/60 bg-card/40 p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 font-mono text-xs text-primary">{r.seq}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{r.operation}</div>
                      <div className="text-[11px] text-muted-foreground">{findWorkstation(r.workstationId)?.name} · setup {r.setupMin}m · run {r.runMin}m</div>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground pl-11">{r.instructions}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "inventory" && (
        <Panel>
          {inv.length === 0 ? <p className="text-xs text-muted-foreground">No stock on hand.</p> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium text-right">On Hand</th>
                  <th className="pb-2 font-medium text-right">Reserved</th>
                  <th className="pb-2 font-medium text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {inv.map((i, idx) => (
                  <tr key={idx} className="border-b border-border/30">
                    <td className="py-2 text-sm">{i.workstationId ? findWorkstation(i.workstationId)?.name : "Main Warehouse"}</td>
                    <td className="py-2 text-right font-mono text-sm">{i.qty.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-sm text-warning">{i.reserved.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-sm text-success">{(i.qty - i.reserved).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      )}
    </div>
  );
}
