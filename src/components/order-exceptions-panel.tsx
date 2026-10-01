import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Panel } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { ExceptionEditor } from "@/components/exception-editor";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { excKey, isOpenExc, useExceptions, type OrderException } from "@/lib/exceptions-db";
import { useReturns } from "@/lib/returns-db";

/** Exceptions and returns for one order — part of the single order view. */
export function OrderExceptionsPanel({ order }: { order: { id: string; number: string } }) {
  useRealtimeInvalidate("order_exceptions" as never, [excKey]);
  const { data: all = [] } = useExceptions();
  const { data: rets = [] } = useReturns();
  const [edit, setEdit] = useState<Partial<OrderException> | null>(null);
  const exc = all.filter((e) => e.order_id === order.id);
  const myRets = rets.filter((r) => r.order_id === order.id);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Exceptions <span className="text-muted-foreground">({exc.filter(isOpenExc).length} open)</span></h3>
          <button onClick={() => setEdit({ order_id: order.id })} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px]"><Plus className="h-3 w-3" /> Raise</button>
        </div>
        <ul className="space-y-1.5">
          {exc.map((e) => (
            <li key={e.id}><button onClick={() => setEdit(e)} className="flex w-full items-center gap-2 rounded-md border border-border/50 p-2 text-left text-xs hover:bg-card">
              <span className="font-mono text-primary">{e.number}</span><span className="flex-1 truncate">{e.title}</span>
              <span className="capitalize text-muted-foreground">{e.severity}</span><StatusPill status={e.status} />
            </button></li>
          ))}
          {exc.length === 0 && <li className="text-xs text-muted-foreground">No exceptions on this order.</li>}
        </ul>
      </Panel>
      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Returns</h3>
        <ul className="space-y-1.5">
          {myRets.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md border border-border/50 p-2 text-xs">
              <Link to="/returns/$returnId" params={{ returnId: r.id }} className="font-mono text-primary hover:underline">{r.number}</Link>
              <span className="flex-1 truncate text-muted-foreground">{r.reason ?? ""}</span><StatusPill status={r.status} />
            </li>
          ))}
          {myRets.length === 0 && <li className="text-xs text-muted-foreground">No returns on this order.</li>}
        </ul>
      </Panel>
      <ExceptionEditor open={!!edit} onOpenChange={(v) => !v && setEdit(null)} initial={edit} orders={[order]} />
    </div>
  );
}
