import { createFileRoute, Link } from "@tanstack/react-router";
import { Play, Pause, CheckCircle2 } from "lucide-react";
import { workOrders, findPO, findProduct, findWorkstation, findUser, workstations } from "@/lib/oms-data";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, Panel } from "@/components/page-shell";

export const Route = createFileRoute("/execution")({
  head: () => ({ meta: [{ title: "Operator Console · CORTA OMS" }] }),
  component: Execution,
});

function Execution() {
  const assigned = workOrders.filter(w => ["pending", "in_progress", "paused"].includes(w.status));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Operator Console"
        subtitle="Shop-floor queue for the current shift"
        actions={
          <select className="h-9 rounded-lg border border-border/60 bg-card/60 px-3 text-xs">
            {workstations.map(w => <option key={w.id}>{w.name}</option>)}
          </select>
        }
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {assigned.map(w => {
          const po = findPO(w.productionOrderId);
          const product = po && findProduct(po.productId);
          const ws = findWorkstation(w.workstationId);
          const operator = w.operatorId ? findUser(w.operatorId) : null;
          return (
            <div key={w.id} className="glass-panel rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs text-primary">{w.number}</div>
                  <div className="mt-1 text-base font-semibold">{w.operation}</div>
                  <div className="text-[11px] text-muted-foreground">{product?.name}</div>
                </div>
                <StatusPill status={w.status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border/60 bg-card/40 p-2">
                  <div className="font-mono text-xl font-semibold text-primary">{w.qtyProduced}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Good</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/40 p-2">
                  <div className="font-mono text-xl font-semibold text-warning">{w.qtyScrap}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Scrap</div>
                </div>
                <div className="rounded-lg border border-border/60 bg-card/40 p-2">
                  <div className="font-mono text-xl font-semibold">{w.qtyTarget}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-to-r from-primary to-info" style={{ width: `${w.progress}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{ws?.name}</span>
                <span>{operator?.fullName ?? "Unassigned"}</span>
              </div>
              <div className="mt-3 flex gap-2">
                {w.status === "pending" && (
                  <Link to="/work-orders/$woId" params={{ woId: w.id }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                    <Play className="h-3.5 w-3.5" /> Start
                  </Link>
                )}
                {w.status === "in_progress" && (
                  <>
                    <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"><Pause className="h-3.5 w-3.5" /> Pause</button>
                    <Link to="/work-orders/$woId" params={{ woId: w.id }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Complete</Link>
                  </>
                )}
                {w.status === "paused" && (
                  <Link to="/work-orders/$woId" params={{ woId: w.id }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                    <Play className="h-3.5 w-3.5" /> Resume
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {assigned.length === 0 && (
        <Panel>
          <p className="text-center text-sm text-muted-foreground py-8">No active work orders for this shift.</p>
        </Panel>
      )}
    </div>
  );
}
