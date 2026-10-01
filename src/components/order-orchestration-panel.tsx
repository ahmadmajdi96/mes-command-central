import { useState } from "react";
import { Workflow, PauseCircle, PlayCircle } from "lucide-react";
import { Panel } from "@/components/page-shell";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { useLocations } from "@/lib/inventory-db";
import { orchKey, useMilestones, useDecisions, useOrchestrate, useNextStatuses, useSetOrderStatus } from "@/lib/orchestration-db";

type Line = { id: string; product?: { sku?: string } | null };

export function OrderOrchestrationPanel({ order, lines }: { order: { id: string; status: string; route?: string | null; hold_reason?: string | null; channel?: string }; lines: Line[] }) {
  useRealtimeInvalidate("order_milestones" as never, [orchKey]);
  useRealtimeInvalidate("sourcing_decisions" as never, [orchKey]);
  const { data: ms = [] } = useMilestones(order.id);
  const { data: ds = [] } = useDecisions(order.id);
  const { data: locs = [] } = useLocations();
  const orchestrate = useOrchestrate();
  const setStatus = useSetOrderStatus();
  const next = useNextStatuses(order.status);
  const [reason, setReason] = useState("");
  const loc = (id: string | null) => locs.find((l) => l.id === id)?.code ?? "—";
  const sku = (id: string) => lines.find((l) => l.id === id)?.product?.sku ?? id.slice(0, 6);
  const canRun = ["confirmed", "on_hold", "sourced"].includes(order.status);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Orchestration & sourcing</h3>
          <div className="flex flex-wrap gap-2">
            <button disabled={!canRun || orchestrate.isPending} onClick={() => orchestrate.mutate(order.id)}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary disabled:opacity-40">
              <Workflow className="h-3.5 w-3.5" /> {orchestrate.isPending ? "Running…" : "Run sourcing"}
            </button>
            {next.includes("on_hold") && (
              <span className="flex items-center gap-1">
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Hold reason" className="h-8 w-32 rounded-md border border-border/60 bg-card/60 px-2 text-xs" />
                <button onClick={() => setStatus.mutate({ id: order.id, status: "on_hold", hold_reason: reason || "Manual hold" })}
                  className="flex items-center gap-1 rounded-lg border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs text-warning"><PauseCircle className="h-3.5 w-3.5" /> Hold</button>
              </span>
            )}
            {order.status === "on_hold" && (
              <button onClick={() => setStatus.mutate({ id: order.id, status: "confirmed", hold_reason: null })}
                className="flex items-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2 py-1.5 text-xs text-success"><PlayCircle className="h-3.5 w-3.5" /> Release hold</button>
            )}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          <span>Channel: <b className="text-foreground">{order.channel ?? "direct"}</b></span>
          <span>Route: <b className="text-foreground">{order.route ?? "default"}</b></span>
          {order.hold_reason && order.status === "on_hold" && <span className="text-warning">Hold: {order.hold_reason}</span>}
        </div>
        {!canRun && <p className="mb-2 text-[11px] text-muted-foreground">Sourcing runs on confirmed or held orders.</p>}
        {ds.length === 0 ? <p className="text-xs text-muted-foreground">No sourcing decisions yet.</p> : (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-1 text-left">Line</th><th className="text-left">Rank</th><th className="text-left">Location</th><th className="text-right">Qty</th><th className="text-left pl-3">Result</th></tr></thead>
            <tbody>{ds.map((d) => (
              <tr key={d.id} className="border-t border-border/40">
                <td className="py-1 font-mono">{sku(d.order_line_id)}</td><td>{d.rank}</td><td className="font-mono">{loc(d.location_id)}</td>
                <td className="text-right font-mono">{d.qty}</td>
                <td className={`pl-3 ${d.status === "selected" ? "text-success" : d.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                  {d.status}{d.failure_reason ? ` · ${d.failure_reason}` : ""}
                </td>
              </tr>))}</tbody>
          </table>
        )}
      </Panel>
      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Milestones</h3>
        {ms.length === 0 ? <p className="text-xs text-muted-foreground">No milestones yet.</p> : (
          <ol className="relative space-y-3 border-l border-border/60 pl-4">
            {ms.map((m) => (
              <li key={m.id} className="text-xs">
                <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="font-medium capitalize">{m.milestone.replace(/_/g, " ")}{m.from_status ? <span className="text-muted-foreground"> · {m.from_status} → {m.to_status}</span> : null}</div>
                <div className="text-[10px] text-muted-foreground">{new Date(m.at).toLocaleString()} · {m.source}{m.notes ? ` · ${m.notes}` : ""}</div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
