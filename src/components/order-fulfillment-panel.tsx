import { PackageCheck } from "lucide-react";
import { Panel } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { FulfillmentActions } from "@/components/fulfillment-actions";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { backorderOf, fulKey, useCreateFulfillments, useOrderFulfillment } from "@/lib/fulfillment-db";

type Line = { id: string; product_id: string | null; qty: number; product?: { sku?: string; name?: string } | null };

export function OrderFulfillmentPanel({ orderId, lines }: { orderId: string; lines: Line[] }) {
  useRealtimeInvalidate("fulfillments" as never, [fulKey]);
  const { data } = useOrderFulfillment(orderId);
  const create = useCreateFulfillments();
  const ful = data?.fulfillments ?? [];
  const prog = data?.progress ?? [];
  const label = (id: string) => { const l = lines.find((x) => x.id === id); return l?.product?.sku ?? l?.product?.name ?? "Line"; };
  const waiting = prog.reduce((s, p) => s + Number(p.allocated_open), 0);

  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Fulfillment & backorders</h3>
        <button disabled={!waiting || create.isPending} onClick={() => create.mutate(orderId)}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary disabled:opacity-50">
          <PackageCheck className="h-3.5 w-3.5" /> Create fulfillments{waiting ? ` (${waiting} units ready)` : ""}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr><th className="py-1 text-left">Product</th><th className="text-right">Ordered</th><th className="text-right">Shipped</th><th className="text-right">In fulfillment</th><th className="text-right">Allocated, waiting</th><th className="text-right">Backorder</th></tr>
          </thead>
          <tbody>
            {prog.map((p) => { const bo = backorderOf(p); return (
              <tr key={p.order_line_id} className="border-t border-border/40">
                <td className="py-1.5">{label(p.order_line_id)}</td>
                <td className="text-right font-mono">{Number(p.ordered)}</td>
                <td className="text-right font-mono text-success">{Number(p.shipped)}</td>
                <td className="text-right font-mono">{Number(p.in_fulfillment)}</td>
                <td className="text-right font-mono">{Number(p.allocated_open)}</td>
                <td className={`text-right font-mono ${bo ? "text-warning" : ""}`}>{bo}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2">
        {ful.length === 0 && <p className="text-xs text-muted-foreground">No fulfillments yet. Allocate stock (or run sourcing), then create fulfillments — one is made per location.</p>}
        {ful.map((f) => {
          const fl = (data?.lines ?? []).filter((x) => x.fulfillment_id === f.id);
          const ev = (data?.events ?? []).filter((x) => x.fulfillment_id === f.id);
          return (
            <div key={f.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-primary">{f.number}</span>
                <StatusPill status={f.status} />
                <span className="text-[11px] text-muted-foreground">from {f.location_code ?? "—"}{f.carrier ? ` · ${f.carrier}` : ""}{f.tracking ? ` · ${f.tracking}` : ""}</span>
                <div className="ml-auto"><FulfillmentActions f={f} /></div>
              </div>
              <div className="mt-1 text-[11px]">{fl.map((x) => `${label(x.order_line_id)} × ${Number(x.qty)}`).join(" · ")}</div>
              {f.failure_reason && f.status === "failed" && <div className="mt-1 text-[11px] text-destructive">Failed: {f.failure_reason}</div>}
              {ev.length > 0 && (
                <ol className="mt-2 space-y-0.5 border-l border-border/60 pl-3 text-[11px] text-muted-foreground">
                  {ev.map((e) => <li key={e.id}><span className="capitalize text-foreground">{e.to_status}</span> · {new Date(e.at).toLocaleString()}{e.notes ? ` · ${e.notes}` : ""}</li>)}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
