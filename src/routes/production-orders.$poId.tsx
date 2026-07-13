import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Play, XCircle, CheckCircle2 } from "lucide-react";
import {
  findPO, findProduct, findSO, workOrders, findWorkstation, boms, routings, findCustomer,
} from "@/lib/oms-data";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, Panel, Field } from "@/components/page-shell";

export const Route = createFileRoute("/production-orders/$poId")({
  head: ({ params }) => ({ meta: [{ title: `${params.poId} · Production Order · CORTA OMS` }] }),
  loader: ({ params }) => {
    const po = findPO(params.poId);
    if (!po) throw notFound();
    return po;
  },
  component: PODetail,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Production order not found.</p>,
});

function PODetail() {
  const po = Route.useLoaderData();
  const product = findProduct(po.productId);
  const so = po.salesOrderId ? findSO(po.salesOrderId) : null;
  const customer = so ? findCustomer(so.customerId) : null;
  const wos = workOrders.filter(w => w.productionOrderId === po.id).sort((a, b) => a.seq - b.seq);
  const bom = boms[po.productId] ?? [];
  const routing = routings[po.productId] ?? [];
  const pct = Math.round((po.qtyProduced / po.qty) * 100);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/production-orders" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Production Orders</span></Link>}
        title={po.number}
        subtitle={`${product?.name} · qty ${po.qty}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={po.status} />
            {po.status === "planned" && <button className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"><Play className="h-3.5 w-3.5" /> Release</button>}
            {po.status === "in_progress" && <button className="flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Complete</button>}
            <button className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"><XCircle className="h-3.5 w-3.5" /> Cancel</button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel className="lg:col-span-3">
          <h3 className="mb-3 text-sm font-semibold">Progress</h3>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-3xl font-semibold text-glow">{po.qtyProduced}<span className="text-lg text-muted-foreground"> / {po.qty}</span></span>
            <span className="text-xs text-muted-foreground">{pct}% complete · {po.qtyScrap} scrap</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-info" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Planned Start" value={po.plannedStart} mono />
            <Field label="Planned End" value={po.plannedEnd} mono />
            <Field label="Actual Start" value={po.actualStart ?? "—"} mono />
            <Field label="Priority" value={`P${po.priority}`} mono />
          </div>
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Linked</h3>
          <div className="space-y-3">
            {so && customer ? (
              <>
                <Field label="Sales Order" value={<Link to="/orders/$orderId" params={{ orderId: so.id }} className="text-primary hover:underline">{so.number}</Link>} />
                <Field label="Customer" value={customer.name} />
              </>
            ) : <p className="text-xs text-muted-foreground">Make-to-stock (no SO)</p>}
            <Field label="Product" value={<span>{product?.name}<div className="font-mono text-[11px] text-muted-foreground">{product?.sku}</div></span>} />
          </div>
        </Panel>
      </div>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Work Orders ({wos.length})</h3>
        <div className="space-y-2">
          {wos.map(w => {
            const ws = findWorkstation(w.workstationId);
            return (
              <div key={w.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/40 p-3">

                <div className="flex items-center gap-3 min-w-0">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 font-mono text-xs text-primary">{w.seq}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary">{w.number}</span>
                      <span className="text-sm font-medium truncate">{w.operation}</span>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{ws?.name} · {w.qtyProduced}/{w.qtyTarget}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-info" style={{ width: `${w.progress}%` }} />
                  </div>
                  <StatusPill status={w.status} />
                </div>
              </Link>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Bill of Materials</h3>
          {bom.length === 0 ? <p className="text-xs text-muted-foreground">No BOM defined.</p> : (
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
                        <div className="text-sm">{c?.name}</div>
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
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Routing</h3>
          {routing.length === 0 ? <p className="text-xs text-muted-foreground">No routing defined.</p> : (
            <div className="space-y-2">
              {routing.map((r) => (
                <div key={r.seq} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-primary/10 font-mono text-[11px] text-primary">{r.seq}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{r.operation}</div>
                    <div className="text-[11px] text-muted-foreground">{findWorkstation(r.workstationId)?.name} · setup {r.setupMin}m · run {r.runMin}m</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
