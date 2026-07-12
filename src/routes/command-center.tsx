import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Activity, TrendingUp, AlertOctagon, Cable, Cpu, ShieldCheck } from "lucide-react";
import { PageHeader, Panel, DataTable, type Column } from "@/components/page-shell";
import {
  useKpiSnapshots, useIntegrationEvents, useIntegrationSettings,
  type KpiSnapshot, type IntegrationEvent,
} from "@/lib/integrations-db";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { sisterLabel } from "@/lib/integrations-client";
import { StatusPill } from "@/components/status-pill";

export const Route = createFileRoute("/command-center")({
  head: () => ({ meta: [
    { title: "Command Center · CORTA OMS" },
    { name: "description", content: "Unified KPIs from OMS, MES and QC — one screen for the whole plant." },
  ]}),
  component: CommandCenter,
});

function useCounts() {
  return useQuery({
    queryKey: ["cc-counts"],
    queryFn: async () => {
      const [so, wo, insp, ncr, dt] = await Promise.all([
        supabase.from("sales_orders").select("id, status", { count: "exact", head: false }).limit(1000),
        supabase.from("work_orders").select("id, status", { count: "exact", head: false }).limit(1000),
        supabase.from("qc_inspections").select("id, status").limit(1000),
        supabase.from("non_conformances").select("id, status").limit(1000),
        supabase.from("downtime_events").select("id, ended_at, minutes").limit(1000),
      ]);
      return {
        orders: so.data ?? [],
        wos: wo.data ?? [],
        insps: insp.data ?? [],
        ncrs: ncr.data ?? [],
        downtimes: dt.data ?? [],
      };
    },
    refetchInterval: 30_000,
  });
}

function CommandCenter() {
  const { data: kpis = [] } = useKpiSnapshots();
  const { data: events = [] } = useIntegrationEvents();
  const { data: settings = [] } = useIntegrationSettings();
  const { data: counts } = useCounts();
  useRealtimeInvalidate("kpi_snapshots", [["kpi_snapshots"]]);

  const rollup = useMemo(() => {
    const c = counts ?? { orders: [], wos: [], insps: [], ncrs: [], downtimes: [] };
    const openOrders = c.orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
    const activeWos = c.wos.filter((w) => w.status === "in_progress" || w.status === "released").length;
    const passRate = c.insps.length ? (c.insps.filter((i) => i.status === "pass").length / c.insps.length) * 100 : 0;
    const openNcr = c.ncrs.filter((n) => n.status !== "closed").length;
    const dtMinutes = c.downtimes.reduce((s, d) => s + (d.minutes ?? 0), 0);
    return { openOrders, activeWos, passRate, openNcr, dtMinutes };
  }, [counts]);

  const kpiCols: Column<KpiSnapshot>[] = [
    { key: "captured_at", label: "Time", sortAccessor: (r) => r.captured_at, render: (r) => <span className="font-mono text-[11px]">{new Date(r.captured_at).toLocaleString()}</span> },
    { key: "source", label: "Source", sortAccessor: (r) => r.source, render: (r) => <span className="font-mono text-[11px] uppercase">{r.source}</span> },
    { key: "metric", label: "Metric", sortAccessor: (r) => r.metric, render: (r) => r.metric },
    { key: "value", label: "Value", align: "right", sortAccessor: (r) => Number(r.value), render: (r) => <span className="font-mono">{Number(r.value).toFixed(2)}{r.unit ? ` ${r.unit}` : ""}</span> },
  ];

  const eventCols: Column<IntegrationEvent>[] = [
    { key: "created_at", label: "Time", sortAccessor: (r) => r.created_at, render: (r) => <span className="font-mono text-[11px]">{new Date(r.created_at).toLocaleTimeString()}</span> },
    { key: "source", label: "Source", sortAccessor: (r) => r.source, render: (r) => <span className="font-mono text-[11px] uppercase">{r.source}</span> },
    { key: "direction", label: "Dir", sortAccessor: (r) => r.direction, render: (r) => <span className={r.direction === "inbound" ? "text-info" : "text-primary"}>{r.direction}</span> },
    { key: "event_type", label: "Event", sortAccessor: (r) => r.event_type, render: (r) => <span className="font-mono text-xs">{r.event_type}</span> },
    { key: "status", label: "Status", sortAccessor: (r) => r.status, render: (r) => <StatusPill status={r.status === "ok" ? "completed" : "cancelled"} /> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Command Center"
        subtitle="Plant-wide KPIs · unified view across OMS, MES and QC"
      />

      <div className="grid gap-3 md:grid-cols-5">
        <Kpi icon={<TrendingUp className="h-4 w-4 text-info" />} label="Open orders" value={rollup.openOrders} />
        <Kpi icon={<Activity className="h-4 w-4 text-primary" />} label="Active WOs" value={rollup.activeWos} />
        <Kpi icon={<ShieldCheck className="h-4 w-4 text-success" />} label="QC pass %" value={`${rollup.passRate.toFixed(1)}%`} />
        <Kpi icon={<AlertOctagon className="h-4 w-4 text-destructive" />} label="Open NCRs" value={rollup.openNcr} />
        <Kpi icon={<Cpu className="h-4 w-4 text-warning" />} label="Downtime (min)" value={rollup.dtMinutes} />
      </div>

      <Panel>
        <div className="mb-3 flex items-center gap-2">
          <Cable className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Integrations</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(["mes","qc","command_center"] as const).map((sys) => {
            const s = settings.find((x) => x.system === sys);
            return (
              <div key={sys} className="rounded-xl border border-border/60 bg-card/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold">{sisterLabel(sys)}</div>
                  <StatusPill status={s?.enabled ? "active" : "offline"} />
                </div>
                <div className="text-[11px] text-muted-foreground truncate font-mono">{s?.base_url || "not configured"}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Last sync: {s?.last_sync_at ? new Date(s.last_sync_at).toLocaleString() : "never"}
                  {s?.last_status && <> · <span className={s.last_status.startsWith("error") ? "text-destructive" : "text-success"}>{s.last_status}</span></>}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">KPI Snapshots</h3>
          <DataTable columns={kpiCols} rows={kpis} defaultSort={{ key: "captured_at", dir: "desc" }} pageSize={10}
            empty="No KPI snapshots yet — Command Center Pro pushes to /api/public/webhooks/command-center." />
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Integration Feed</h3>
          <DataTable columns={eventCols} rows={events} defaultSort={{ key: "created_at", dir: "desc" }} pageSize={10}
            empty="No integration events yet." />
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {icon}{label}
      </div>
      <div className="font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}
