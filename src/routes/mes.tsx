import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Activity, AlertTriangle, PauseCircle, Plus, RefreshCcw, Radio } from "lucide-react";
import { PageHeader, Panel, DataTable, type Column } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { FormDialog } from "@/components/form-dialog";
import {
  useStationStatuses, useDowntimeEvents, useCreateDowntime, useUpsertStation,
  useIntegrationSettings, useMarkSync,
  type StationStatus, type DowntimeEvent,
} from "@/lib/integrations-db";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { fetchFromSister, sisterLabel } from "@/lib/integrations-client";
import { downloadCSV, toCSV } from "@/lib/csv";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/mes")({
  head: () => ({ meta: [
    { title: "MES Hub · CORTA OMS" },
    { name: "description", content: "Live shop-floor execution: stations, OEE, downtime and MES Command Center integration." },
  ]}),
  component: MesHub,
});

function MesHub() {
  const role = useStore((s) => s.role);
  const canWrite = role === "admin" || role === "supervisor";
  const { data: stations = [] } = useStationStatuses();
  const { data: downtimes = [] } = useDowntimeEvents();
  const { data: settings = [] } = useIntegrationSettings();
  const create = useCreateDowntime();
  const upsertStation = useUpsertStation();
  const markSync = useMarkSync();
  useRealtimeInvalidate("station_status", [["station_status"]]);
  useRealtimeInvalidate("downtime_events", [["downtime_events"]]);

  const [dtOpen, setDtOpen] = useState(false);
  const [stOpen, setStOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const mesSetting = settings.find((s) => s.system === "mes");

  const kpi = useMemo(() => {
    const running = stations.filter((s) => s.state === "running").length;
    const down = stations.filter((s) => s.state === "down").length;
    const openDt = downtimes.filter((d) => !d.ended_at).length;
    const oees = stations.map((s) => Number(s.oee ?? 0)).filter((v) => v > 0);
    const avgOee = oees.length ? oees.reduce((a, b) => a + b, 0) / oees.length : 0;
    return { running, down, openDt, avgOee, total: stations.length };
  }, [stations, downtimes]);

  async function syncFromMes() {
    if (!mesSetting?.base_url) { toast.error("Configure MES base URL in Settings"); return; }
    setSyncing(true);
    const r = await fetchFromSister<{ stations?: Array<Partial<StationStatus>> }>("mes", mesSetting.base_url);
    setSyncing(false);
    if (!r.ok) { toast.error(`MES sync failed: ${r.error}`); markSync.mutate({ system: "mes", status: `error: ${r.error}` }); return; }
    toast.success(`Fetched ${(r.data.stations ?? []).length} station rows from MES`);
    markSync.mutate({ system: "mes", status: "ok" });
  }

  const stationCols: Column<StationStatus>[] = [
    { key: "station_code", label: "Station", sortAccessor: (r) => r.station_code, render: (r) => <span className="font-mono text-xs">{r.station_code}</span> },
    { key: "name", label: "Name", sortAccessor: (r) => r.name, render: (r) => r.name },
    { key: "state", label: "State", sortAccessor: (r) => r.state, render: (r) => <StatusPill status={r.state} /> },
    { key: "operator", label: "Operator", sortAccessor: (r) => r.operator ?? "", render: (r) => r.operator ?? "—" },
    { key: "oee", label: "OEE %", align: "right", sortAccessor: (r) => Number(r.oee ?? 0), render: (r) => r.oee != null ? <span className="font-mono">{Number(r.oee).toFixed(1)}</span> : "—" },
    { key: "hb", label: "Heartbeat", sortAccessor: (r) => r.last_heartbeat_at, render: (r) => <span className="font-mono text-[11px] text-muted-foreground">{new Date(r.last_heartbeat_at).toLocaleTimeString()}</span> },
  ];

  const downtimeCols: Column<DowntimeEvent>[] = [
    { key: "started_at", label: "Started", sortAccessor: (r) => r.started_at, render: (r) => <span className="font-mono text-[11px]">{new Date(r.started_at).toLocaleString()}</span> },
    { key: "workstation", label: "Station", sortAccessor: (r) => r.workstation ?? "", render: (r) => r.workstation ?? "—" },
    { key: "reason", label: "Reason", sortAccessor: (r) => r.reason, render: (r) => r.reason },
    { key: "category", label: "Category", sortAccessor: (r) => r.category ?? "", render: (r) => r.category ?? "—" },
    { key: "minutes", label: "Duration", align: "right", sortAccessor: (r) => r.minutes ?? 0, render: (r) => r.minutes != null ? `${r.minutes} min` : <span className="text-warning">ongoing</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="MES Hub"
        subtitle={`Live shop-floor · connected to ${sisterLabel("mes")}`}
        actions={
          <>
            <button onClick={syncFromMes} disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card disabled:opacity-50">
              <RefreshCcw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync from MES
            </button>
            <button onClick={() => downloadCSV("stations", toCSV(stations, stationCols.map((c) => ({ key: c.key, label: c.label, get: (r: StationStatus) => (r as unknown as Record<string, unknown>)[c.key] }))))}
              className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card">Export CSV</button>
            {canWrite && (
              <>
                <button onClick={() => setStOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20">
                  <Plus className="h-3.5 w-3.5" /> Register Station
                </button>
                <button onClick={() => setDtOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-warning hover:bg-warning/20">
                  <PauseCircle className="h-3.5 w-3.5" /> Log Downtime
                </button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={<Radio className="h-4 w-4 text-success" />} label="Running" value={`${kpi.running}/${kpi.total}`} />
        <Kpi icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Down" value={kpi.down} />
        <Kpi icon={<PauseCircle className="h-4 w-4 text-warning" />} label="Open downtime" value={kpi.openDt} />
        <Kpi icon={<Activity className="h-4 w-4 text-primary" />} label="Avg OEE" value={`${kpi.avgOee.toFixed(1)}%`} />
      </div>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Workstations</h3>
        <DataTable columns={stationCols} rows={stations} defaultSort={{ key: "station_code", dir: "asc" }} empty="No stations. Register one, or sync from MES." />
      </Panel>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Recent Downtime</h3>
        <DataTable columns={downtimeCols} rows={downtimes} defaultSort={{ key: "started_at", dir: "desc" }} empty="No downtime recorded." />
      </Panel>

      <FormDialog
        open={dtOpen} onOpenChange={setDtOpen}
        title="Log Downtime"
        fields={[
          { name: "workstation", label: "Station code", type: "text" },
          { name: "reason", label: "Reason", type: "text", required: true },
          { name: "category", label: "Category", type: "select", options: [
            { value: "unplanned", label: "Unplanned" }, { value: "planned", label: "Planned" },
            { value: "changeover", label: "Changeover" }, { value: "material", label: "Material" },
          ]},
        ]}
        onSubmit={async (values) => {
          await create.mutateAsync({
            workstation: (values.workstation as string) || null,
            reason: values.reason as string,
            category: (values.category as string) || "unplanned",
          });
          setDtOpen(false);
        }}
      />

      <FormDialog
        open={stOpen} onOpenChange={setStOpen}
        title="Register Station"
        fields={[
          { name: "station_code", label: "Station code", type: "text", required: true },
          { name: "name", label: "Display name", type: "text", required: true },
          { name: "state", label: "State", type: "select", options: [
            { value: "idle", label: "Idle" }, { value: "running", label: "Running" },
            { value: "down", label: "Down" }, { value: "maintenance", label: "Maintenance" }, { value: "offline", label: "Offline" },
          ]},
          { name: "operator", label: "Operator", type: "text" },
        ]}
        onSubmit={async (values) => {
          await upsertStation.mutateAsync({
            station_code: values.station_code as string,
            name: values.name as string,
            state: (values.state as StationStatus["state"]) ?? "idle",
            operator: (values.operator as string) || null,
          });
          setStOpen(false);
        }}
      />
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
