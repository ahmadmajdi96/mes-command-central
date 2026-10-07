import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpCircle } from "lucide-react";
import { Panel } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { excKey, useEscalate, usePriorityQueue, type QueueRow } from "@/lib/exceptions-db";

const sevColor: Record<string, string> = { low: "text-muted-foreground", medium: "text-info", high: "text-warning", critical: "text-destructive" };
const kind = (r: QueueRow) => r.integration_message_id ? "Failed message" : r.fulfillment_id ? "Delayed fulfillment" : r.type === "delayed" && r.order_id ? "Overdue order" : r.type.replace(/_/g, " ");

/** Open problems ranked by severity, escalation level and how long they are past due. */
export function PriorityQueuePanel({ limit = 10, title = "Priority queue" }: { limit?: number; title?: string }) {
  useRealtimeInvalidate("order_exceptions" as never, [excKey]);
  const { data: rows = [], isLoading } = usePriorityQueue();
  const run = useEscalate();
  const counts = {
    orders: rows.filter((r) => kind(r) === "Overdue order").length,
    ful: rows.filter((r) => kind(r) === "Delayed fulfillment").length,
    msg: rows.filter((r) => kind(r) === "Failed message").length,
  };
  return (
    <Panel>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-warning" /> {title}</h3>
        <span className="text-[11px] text-muted-foreground">{rows.length} open · {counts.orders} overdue orders · {counts.ful} delayed fulfillments · {counts.msg} failed messages</span>
        <button onClick={() => run.mutate(undefined)} disabled={run.isPending} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1 text-xs text-warning disabled:opacity-50">
          <ArrowUpCircle className="h-3.5 w-3.5" /> {run.isPending ? "Checking…" : "Check now"}
        </button>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">Checked automatically every 5 minutes. Problems that clear up are closed automatically.</p>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-xs text-muted-foreground">No open problems.</p> : (
        <div className="divide-y divide-border/50 text-xs">
          {rows.slice(0, limit).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <span className="w-10 font-mono text-[10px] text-muted-foreground" title="Priority score">{r.priority_score}</span>
              <span className={`w-16 font-medium capitalize ${sevColor[r.severity]}`}>{r.severity}</span>
              <span className="w-36 capitalize text-muted-foreground">{kind(r)}</span>
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              {r.order_id && r.order_number && <Link to="/orders/$orderId" params={{ orderId: r.order_id }} className="font-mono text-primary hover:underline">{r.order_number}</Link>}
              {r.integration_message_id && <Link to="/integrations" className="text-primary hover:underline">Open in Integration Monitor</Link>}
              <StatusPill status={r.status} />
              {r.escalation_level > 0 && <span className="text-[10px] text-warning">L{r.escalation_level}</span>}
            </div>
          ))}
          {rows.length > limit && <Link to="/exceptions" className="block pt-2 text-primary hover:underline">See all {rows.length} on the Exceptions page</Link>}
        </div>
      )}
    </Panel>
  );
}
