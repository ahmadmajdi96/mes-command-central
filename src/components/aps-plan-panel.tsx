import { CalendarClock, AlertTriangle } from "lucide-react";
import { Panel } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { isPlanStale } from "@/lib/aps-plan";

type Po = {
  status: string; planning_status: string; revision: number;
  aps_schedule_version: string | null; aps_machine: string | null; aps_sequence: number | null;
  aps_planned_start: string | null; aps_planned_end: string | null; aps_plan_revision: number | null;
  aps_approved_at: string | null; aps_feasibility: string | null;
};

const STEPS = ["released", "planned", "dispatched", "in_progress", "complete"];
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : "—");

/** Schedule placement from the APS planning app. APS owns placement; status and quantity stay in this app. */
export function ApsPlanPanel({ po }: { po: Po }) {
  const stale = isPlanStale(po);
  const idx = STEPS.indexOf(po.planning_status);
  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><CalendarClock className="h-4 w-4" /> Plan from APS</h3>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">Planning status <StatusPill status={po.planning_status} /> · revision {po.revision}</span>
      </div>
      <ol className="mb-3 flex flex-wrap gap-1 text-[10px] uppercase tracking-[0.12em]">
        {STEPS.map((s, i) => (
          <li key={s} className={`rounded-md border px-2 py-1 ${i <= idx ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"}`}>{s.replace("_", " ")}</li>
        ))}
      </ol>
      {stale && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This order changed after APS approved its plan (plan is for revision {po.aps_plan_revision}, order is now revision {po.revision}). The change was sent to APS; wait for a new approved schedule.
        </div>
      )}
      {po.aps_schedule_version ? (
        <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <Info label="Schedule version" value={po.aps_schedule_version} />
          <Info label="Machine" value={po.aps_machine ?? "—"} />
          <Info label="Sequence" value={po.aps_sequence ?? "—"} />
          <Info label="Feasibility" value={po.aps_feasibility ?? "—"} />
          <Info label="Planned start" value={fmt(po.aps_planned_start)} />
          <Info label="Planned end" value={fmt(po.aps_planned_end)} />
          <Info label="Approved" value={fmt(po.aps_approved_at)} />
          <Info label="Plan revision" value={po.aps_plan_revision ?? "—"} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {po.status === "released" ? "Sent to APS for planning — no approved schedule has come back yet." : "Release this order to send it to APS for planning."}
        </p>
      )}
    </Panel>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-0.5 font-mono">{value}</div></div>;
}
