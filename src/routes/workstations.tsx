import { createFileRoute } from "@tanstack/react-router";
import { workstations, workOrders } from "@/lib/oms-data";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, Panel } from "@/components/page-shell";
import { Plus, Cpu } from "lucide-react";

export const Route = createFileRoute("/workstations")({
  head: () => ({ meta: [{ title: "Workstations · CORTA OMS" }] }),
  component: WorkstationsPage,
});

function WorkstationsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Workstations"
        subtitle={`${workstations.length} configured · ${workstations.filter(w => w.status === "active").length} active`}
        actions={
          <button className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <Plus className="h-3.5 w-3.5" /> New Workstation
          </button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {workstations.map(w => {
          const load = workOrders.filter(wo => wo.workstationId === w.id && wo.status !== "completed").length;
          const pct = Math.min(100, Math.round((load / w.capacity) * 100));
          return (
            <Panel key={w.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span className="font-mono text-[11px] text-muted-foreground">{w.id}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold">{w.name}</div>
                  <div className="text-[11px] text-muted-foreground">{w.type}</div>
                </div>
                <StatusPill status={w.status} />
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Load</span>
                  <span className="font-mono">{load} / {w.capacity}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{
                    width: `${pct}%`,
                    background: pct >= 80 ? "var(--color-destructive)" : pct >= 50 ? "var(--color-accent)" : "var(--color-success)",
                  }} />
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
