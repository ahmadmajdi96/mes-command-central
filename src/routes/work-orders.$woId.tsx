import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Play, Pause, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { permissionsFor } from "@/lib/roles";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { SopChecklist } from "@/components/sop-checklist";
import { useWorkOrder, useUpdateWorkOrder, useRealtimeInvalidate, workOrderKey, workOrdersKey } from "@/lib/oms-db";

export const Route = createFileRoute("/work-orders/$woId")({
  head: ({ params }) => ({ meta: [{ title: `${params.woId} · Work Order · CORTA OMS` }] }),
  component: WODetail,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Work order not found.</p>,
  errorComponent: ({ error }) => <p className="text-sm text-destructive">{error.message}</p>,
});

function WODetail() {
  const { woId } = Route.useParams();
  const role = useStore((s) => s.role);
  const perms = permissionsFor(role);
  useRealtimeInvalidate("work_orders", [workOrderKey(woId), workOrdersKey]);

  const { data: wo, isLoading } = useWorkOrder(woId);
  const updateWO = useUpdateWorkOrder();

  const [good, setGood] = useState(0);
  const [scrap, setScrap] = useState(0);
  const [labor, setLabor] = useState(0);

  useEffect(() => {
    if (wo) {
      setGood(Number(wo.qty_produced));
      setScrap(Number(wo.qty_scrap));
      setLabor(wo.labor_min);
    }
  }, [wo]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!wo) return <p className="text-sm text-muted-foreground">Work order not found.</p>;

  const canOperate = perms.operateWO && wo.status !== "completed";
  const nowIso = () => new Date().toISOString();

  const action = async (patch: any, note: string, variant: "success" | "info" | "warning" = "info") => {
    await updateWO.mutateAsync({ id: wo.id, patch, note });
    (variant === "success" ? toast.success : variant === "warning" ? toast.warning : toast.info)(note);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/work-orders" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Work Orders</span></Link>}
        title={`${wo.number} · ${wo.operation}`}
        subtitle={`${wo.workstation ?? "—"} · Op ${wo.seq}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={wo.status} />
            {canOperate && wo.status === "pending" && (
              <button onClick={() => action({ status: "in_progress", started_at: nowIso() }, "Started work order", "success")}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Play className="h-3.5 w-3.5" /> Start
              </button>
            )}
            {canOperate && wo.status === "in_progress" && (
              <>
                <button onClick={() => action({ status: "paused" }, "Paused", "warning")}
                  className="flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning">
                  <Pause className="h-3.5 w-3.5" /> Pause
                </button>
                <button onClick={() => action({ status: "completed", completed_at: nowIso(), progress: 100, qty_produced: wo.qty_target }, "Completed", "success")}
                  className="flex items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </button>
              </>
            )}
            {canOperate && wo.status === "paused" && (
              <button onClick={() => action({ status: "in_progress" }, "Resumed", "success")}
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
              {wo.qty_produced}<span className="text-xl text-muted-foreground"> / {wo.qty_target}</span>
            </span>
            <div className="text-right">
              <div className="font-mono text-lg font-semibold tabular-nums">{wo.progress}%</div>
              <div className="text-[11px] text-muted-foreground">{wo.qty_scrap} scrap · {wo.labor_min}m labor</div>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-info transition-all duration-700" style={{ width: `${wo.progress}%` }} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="Sequence" value={`Op ${wo.seq}`} mono />
            <Field label="Started" value={wo.started_at ? new Date(wo.started_at).toLocaleString() : "—"} mono />
            <Field label="Completed" value={wo.completed_at ? new Date(wo.completed_at).toLocaleString() : "—"} mono />
            <Field label="Workstation" value={wo.workstation ?? "—"} />
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
                onClick={async () => {
                  const progress = wo.qty_target > 0 ? Math.min(100, Math.round((good / Number(wo.qty_target)) * 100)) : 0;
                  await updateWO.mutateAsync({
                    id: wo.id,
                    patch: { qty_produced: good, qty_scrap: scrap, labor_min: labor, progress },
                    note: `Logged ${good} good, ${scrap} scrap`,
                  });
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
    </div>
  );
}
