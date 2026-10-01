import { useState } from "react";
import { Panel } from "@/components/page-shell";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { invKey, useLocations, useInventoryLevels, useOrderReservations, useReserve, useRelease, useAllocate, useDeallocate, useReallocate, useAvailability } from "@/lib/inventory-db";
import { AvailabilityBadge } from "@/components/availability-badge";

type Line = { id: string; product_id: string | null; qty: number; product?: { sku?: string; name?: string } | null };
const sel = "h-8 rounded-md border border-border/60 bg-card/60 px-2 text-xs";

export function OrderStockPanel({ orderId, lines }: { orderId: string; lines: Line[] }) {
  useRealtimeInvalidate("reservations" as never, [invKey]);
  useRealtimeInvalidate("allocations" as never, [invKey]);
  const { data: locs = [] } = useLocations();
  const { data: levels = [] } = useInventoryLevels();
  const { data } = useOrderReservations(orderId);
  const release = useRelease(); const dealloc = useDeallocate(); const realloc = useReallocate();
  const lName = (id: string) => locs.find((l) => l.id === id)?.code ?? "—";

  return (
    <Panel>
      <h3 className="mb-3 text-sm font-semibold">Stock: availability, reservations & allocations</h3>
      <div className="space-y-3">
        {lines.filter((l) => l.product_id).map((l) => {
          const res = (data?.reservations ?? []).filter((r) => r.order_line_id === l.id);
          const al = (data?.allocations ?? []).filter((a) => a.order_line_id === l.id);
          return (
            <div key={l.id} className="rounded-lg border border-border/60 p-3">
              <div className="mb-1 text-xs font-medium">{l.product?.sku ?? ""} {l.product?.name ?? ""} · ordered {l.qty}</div>
              <LineAvailability productId={l.product_id!} qty={Number(l.qty)} />
              <LineActions line={l} locs={locs.filter((x) => x.active)} levels={levels} />
              {(res.length > 0 || al.length > 0) && (
                <div className="mt-2 space-y-1 text-[11px]">
                  {res.map((r) => (
                    <div key={r.id} className="flex items-center gap-2">
                      <span className="text-warning">Reserved</span> {r.qty} @ {lName(r.location_id)} · <span className="capitalize">{r.status}</span>
                      {r.expires_at && r.status === "active" && <span className="text-muted-foreground">until {new Date(r.expires_at).toLocaleString()}</span>}
                      {r.status === "active" && <button className="ml-auto text-destructive hover:underline" onClick={() => release.mutate(r.id)}>Release</button>}
                    </div>
                  ))}
                  {al.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <span className="text-success">Allocated</span> {a.qty} @ {lName(a.location_id)} · <span className="capitalize">{a.status}</span>
                      {a.status === "allocated" && (
                        <span className="ml-auto flex items-center gap-2">
                          <select className={sel} defaultValue="" onChange={(e) => e.target.value && realloc.mutate({ allocation: a, location: e.target.value })}>
                            <option value="">Reallocate to…</option>
                            {locs.filter((x) => x.active && x.id !== a.location_id).map((x) => <option key={x.id} value={x.id}>{x.code}</option>)}
                          </select>
                          <button className="text-destructive hover:underline" onClick={() => dealloc.mutate(a.id)}>Deallocate</button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {lines.length === 0 && <p className="text-xs text-muted-foreground">No lines.</p>}
      </div>
    </Panel>
  );
}

function LineAvailability({ productId, qty }: { productId: string; qty: number }) {
  const { data } = useAvailability(productId, qty);
  return data ? <AvailabilityBadge a={data} /> : null;
}

function LineActions({ line, locs, levels }: { line: Line; locs: { id: string; code: string }[]; levels: { product_id: string; location_id: string; available: number }[] }) {
  const [loc, setLoc] = useState(""); const [qty, setQty] = useState(Number(line.qty));
  const reserve = useReserve(); const allocate = useAllocate();
  const avail = (id: string) => levels.find((x) => x.product_id === line.product_id && x.location_id === id)?.available ?? 0;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select className={sel} value={loc} onChange={(e) => setLoc(e.target.value)}>
        <option value="">Location…</option>
        {locs.map((x) => <option key={x.id} value={x.id}>{x.code} ({Number(avail(x.id))} avail.)</option>)}
      </select>
      <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} className={`${sel} w-20`} />
      <button disabled={!loc} className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] text-warning disabled:opacity-50"
        onClick={() => reserve.mutate({ line: line.id, location: loc, qty })}>Reserve</button>
      <button disabled={!loc} className="rounded-md border border-success/40 bg-success/10 px-2 py-1 text-[11px] text-success disabled:opacity-50"
        onClick={() => allocate.mutate({ line: line.id, location: loc, qty })}>Allocate</button>
    </div>
  );
}
