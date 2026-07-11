import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Play, Pause, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  findPO, findProduct, findWorkstation, routings, findUser, findWO,
} from "@/lib/oms-data";
import { useStore, store } from "@/lib/store";
import { permissionsFor } from "@/lib/roles";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { SopChecklist } from "@/components/sop-checklist";

export const Route = createFileRoute("/work-orders/$woId")({
  head: ({ params }) => ({ meta: [{ title: `${params.woId} · Work Order · CORTA OMS` }] }),
  loader: ({ params }) => {
    const wo = findWO(params.woId);
    if (!wo) throw notFound();
    return { id: wo.id };
  },
  component: WODetail,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Work order not found.</p>,
});

function WODetail() {
  const { id } = Route.useLoaderData();
  const wo = useStore((s) => s.workOrders.find((w) => w.id === id))!;
  const role = useStore((s) => s.role);
  const perms = permissionsFor(role);
  const po = findPO(wo.productionOrderId);
  const product = po && findProduct(po.productId);
  const ws = findWorkstation(wo.workstationId);
  const operator = wo.operatorId ? findUser(wo.operatorId) : null;
  const routing = po ? routings[po.productId]?.find((r) => r.seq === wo.seq) : null;

  const [good, setGood] = useState(wo.qtyProduced);
  const [scrap, setScrap] = useState(wo.qtyScrap);
  const [labor, setLabor] = useState(wo.laborMin);

  const canOperate = perms.operateWO && wo.status !== "completed";

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/work-orders" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Work Orders</span></Link>}
        title={`${wo.number} · ${wo.operation}`}
        subtitle={`${product?.name} · ${ws?.name}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={wo.status} />
            {canOperate && wo.status === "pending" && (
              <button onClick={() => { store.startWO(wo.id); toast.success("Work order started"); }}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Play className="h-3.5 w-3.5" /> Start
              </button>
            )}
            {canOperate && wo.status === "in_progress" && (
              <>
                <button onClick={() => { store.pauseWO(wo.id); toast.info("Paused"); }}
                  className="flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning">
                  <Pause className="h-3.5 w-3.5" /> Pause
                </button>
                <button onClick={() => { store.completeWO(wo.id); toast.success("Completed"); }}
                  className="flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </button>
              </>
            )}
            {canOperate && wo.status === "paused" && (
              <button onClick={() => { store.resumeWO(wo.id); toast.success("Resumed"); }}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Play className="h-3.5 w-3.5" /> Resume
              </button>
            )}
            {perms.operateWO && (
              <button onClick={() => toast.warning("Issue reported to supervisor")}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Report Issue
              </button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Live Progress</h3>
            {wo.status === "in_progress" && (
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-success">
                <span className="status-dot text-success animate-pulse-glow" /> Live
              </span>
            )}
          </div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-4xl font-semibold text-glow tabular-nums">
              {wo.qtyProduced}<span className="text-xl text-muted-foreground"> / {wo.qtyTarget}</span>
            </span>
            <div className="text-right">
              <div className="font-mono text-lg font-semibold tabular-nums">{wo.progress}%</div>
              <div className="text-[11px] text-muted-foreground">{wo.qtyScrap} scrap · {wo.laborMin}m labor</div>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-info transition-all duration-700" style={{ width: `${wo.progress}%` }} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Sequence" value={`Op ${wo.seq}`} mono />
            <Field label="Started" value={wo.startedAt ?? "—"} mono />
            <Field label="Completed" value={wo.completedAt ?? "—"} mono />
            <Field label="Operator" value={operator?.fullName ?? "Unassigned"} />
          </div>
        </Panel>

        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Record Output</h3>
          {!perms.operateWO ? (
            <p className="rounded-lg border border-border/60 bg-card/40 p-3 text-xs text-muted-foreground">
              Your role ({role.replace("_", " ")}) is read-only on the operator console.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Good qty</label>
                <input type="number" value={good} onChange={(e) => setGood(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-3 font-mono text-sm focus:border-primary/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Scrap qty</label>
                <input type="number" value={scrap} onChange={(e) => setScrap(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-3 font-mono text-sm focus:border-primary/50 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Labor min</label>
                <input type="number" value={labor} onChange={(e) => setLabor(Number(e.target.value))}
                  className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-3 font-mono text-sm focus:border-primary/50 focus:outline-none" />
              </div>
              <button
                onClick={() => {
                  const progress = Math.min(100, Math.round((good / wo.qtyTarget) * 100));
                  store.updateWO(wo.id, { qtyProduced: good, qtyScrap: scrap, laborMin: labor, progress }, `Logged ${good} good, ${scrap} scrap`);
                  toast.success("Progress logged");
                }}
                className="w-full rounded-lg bg-gradient-to-r from-primary to-info px-3 py-2 text-xs font-medium text-primary-foreground"
              >
                Log Progress
              </button>
            </div>
          )}
        </Panel>
      </div>

      <Panel>
        <SopChecklist woId={wo.id} operation={wo.operation} />
      </Panel>

      {routing && (
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Standard Operating Instructions</h3>
          <div className="rounded-xl border border-info/30 bg-info/5 p-4 text-sm leading-relaxed">
            {routing.instructions}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4 text-xs">
            <Field label="Setup" value={`${routing.setupMin} min`} mono />
            <Field label="Run / unit" value={`${routing.runMin} min`} mono />
            <Field label="Workstation" value={ws?.name} />
            <Field label="Capacity" value={ws?.capacity} mono />
          </div>
        </Panel>
      )}
    </div>
  );
}
