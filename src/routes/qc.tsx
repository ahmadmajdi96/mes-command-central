import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, ShieldAlert, Plus, RefreshCcw } from "lucide-react";
import { PageHeader, Panel, DataTable, type Column } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { FormDialog } from "@/components/form-dialog";
import {
  useQcInspections, useCreateQcInspection, useNonConformances, useCreateNcr,
  useIntegrationSettings, useMarkSync,
  type QcInspection, type NonConformance,
} from "@/lib/integrations-db";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { fetchFromSister, sisterLabel } from "@/lib/integrations-client";
import { downloadCSV, toCSV } from "@/lib/csv";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/qc")({
  head: () => ({ meta: [
    { title: "Quality Hub · CORTA OMS" },
    { name: "description", content: "Quality inspections, non-conformances and NCRs synced with CORTA QC System." },
  ]}),
  component: QcHub,
});

function QcHub() {
  const role = useStore((s) => s.role);
  const canWrite = role === "admin" || role === "supervisor" || role === "operator";
  const { data: inspections = [] } = useQcInspections();
  const { data: ncrs = [] } = useNonConformances();
  const { data: settings = [] } = useIntegrationSettings();
  const createInsp = useCreateQcInspection();
  const createNcr = useCreateNcr();
  const markSync = useMarkSync();
  useRealtimeInvalidate("qc_inspections", [["qc_inspections"]]);
  useRealtimeInvalidate("non_conformances", [["non_conformances"]]);

  const [inspOpen, setInspOpen] = useState(false);
  const [ncrOpen, setNcrOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const qcSetting = settings.find((s) => s.system === "qc");

  const kpi = useMemo(() => {
    const pass = inspections.filter((i) => i.status === "pass").length;
    const fail = inspections.filter((i) => i.status === "fail").length;
    const pending = inspections.filter((i) => i.status === "pending" || i.status === "in_progress").length;
    const openNcr = ncrs.filter((n) => n.status !== "closed").length;
    const rate = inspections.length ? (pass / inspections.length) * 100 : 0;
    return { pass, fail, pending, openNcr, rate };
  }, [inspections, ncrs]);

  async function syncFromQc() {
    if (!qcSetting?.base_url) { toast.error("Configure QC base URL in Settings"); return; }
    setSyncing(true);
    const r = await fetchFromSister<{ inspections?: unknown[] }>("qc", qcSetting.base_url);
    setSyncing(false);
    if (!r.ok) { toast.error(`QC sync failed: ${r.error}`); markSync.mutate({ system: "qc", status: `error: ${r.error}` }); return; }
    toast.success(`Fetched ${(r.data.inspections ?? []).length} inspections from QC`);
    markSync.mutate({ system: "qc", status: "ok" });
  }

  const inspCols: Column<QcInspection>[] = [
    { key: "created_at", label: "Created", sortAccessor: (r) => r.created_at, render: (r) => <span className="font-mono text-[11px]">{new Date(r.created_at).toLocaleString()}</span> },
    { key: "inspection_type", label: "Type", sortAccessor: (r) => r.inspection_type, render: (r) => r.inspection_type },
    { key: "status", label: "Status", sortAccessor: (r) => r.status, render: (r) => <StatusPill status={r.status} /> },
    { key: "inspector", label: "Inspector", sortAccessor: (r) => r.inspector ?? "", render: (r) => r.inspector ?? "—" },
    { key: "sample_size", label: "Sample", align: "right", sortAccessor: (r) => r.sample_size ?? 0, render: (r) => r.sample_size ?? 0 },
    { key: "defects_found", label: "Defects", align: "right", sortAccessor: (r) => r.defects_found ?? 0, render: (r) => <span className={(r.defects_found ?? 0) > 0 ? "text-destructive font-mono" : "font-mono"}>{r.defects_found ?? 0}</span> },
  ];

  const ncrCols: Column<NonConformance>[] = [
    { key: "number", label: "Number", sortAccessor: (r) => r.number, render: (r) => <span className="font-mono text-xs">{r.number}</span> },
    { key: "severity", label: "Severity", sortAccessor: (r) => r.severity, render: (r) => <StatusPill status={r.severity === "critical" ? "cancelled" : r.severity === "major" ? "hold" : "pending"} /> },
    { key: "status", label: "Status", sortAccessor: (r) => r.status, render: (r) => <StatusPill status={r.status === "closed" ? "completed" : r.status === "open" ? "hold" : "in_progress"} /> },
    { key: "raised_by", label: "Raised by", sortAccessor: (r) => r.raised_by ?? "", render: (r) => r.raised_by ?? "—" },
    { key: "raised_at", label: "Raised", sortAccessor: (r) => r.raised_at, render: (r) => <span className="font-mono text-[11px]">{new Date(r.raised_at).toLocaleString()}</span> },
    { key: "description", label: "Description", sortAccessor: (r) => r.description ?? "", render: (r) => <span className="line-clamp-1">{r.description ?? "—"}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quality Hub"
        subtitle={`Inspections + NCRs · connected to ${sisterLabel("qc")}`}
        actions={
          <>
            <button onClick={syncFromQc} disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card disabled:opacity-50">
              <RefreshCcw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync from QC
            </button>
            <button onClick={() => downloadCSV("qc-inspections", toCSV(inspections, inspCols.map((c) => ({ key: c.key, label: c.label, get: (r: QcInspection) => (r as unknown as Record<string, unknown>)[c.key] }))))}
              className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card">Export CSV</button>
            {canWrite && (
              <>
                <button onClick={() => setInspOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20">
                  <Plus className="h-3.5 w-3.5" /> New Inspection
                </button>
                <button onClick={() => setNcrOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/20">
                  <ShieldAlert className="h-3.5 w-3.5" /> Raise NCR
                </button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={<CheckCircle2 className="h-4 w-4 text-success" />} label="Pass rate" value={`${kpi.rate.toFixed(1)}%`} />
        <Kpi icon={<XCircle className="h-4 w-4 text-destructive" />} label="Failed" value={kpi.fail} />
        <Kpi icon={<CheckCircle2 className="h-4 w-4 text-warning" />} label="Pending" value={kpi.pending} />
        <Kpi icon={<ShieldAlert className="h-4 w-4 text-destructive" />} label="Open NCRs" value={kpi.openNcr} />
      </div>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Inspections</h3>
        <DataTable columns={inspCols} rows={inspections} defaultSort={{ key: "created_at", dir: "desc" }} empty="No inspections yet." />
      </Panel>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Non-conformances</h3>
        <DataTable columns={ncrCols} rows={ncrs} defaultSort={{ key: "raised_at", dir: "desc" }} empty="No NCRs — clean quality record." />
      </Panel>

      <FormDialog
        open={inspOpen} onOpenChange={setInspOpen}
        title="Record Inspection"
        fields={[
          { name: "inspection_type", label: "Type", type: "select", options: [
            { value: "incoming", label: "Incoming" }, { value: "in_process", label: "In-process" },
            { value: "final", label: "Final" }, { value: "audit", label: "Audit" },
          ]},
          { name: "status", label: "Result", type: "select", options: [
            { value: "pending", label: "Pending" }, { value: "in_progress", label: "In progress" },
            { value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }, { value: "waived", label: "Waived" },
          ]},
          { name: "inspector", label: "Inspector", type: "text" },
          { name: "sample_size", label: "Sample size", type: "number" },
          { name: "defects_found", label: "Defects", type: "number" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v) => {
          await createInsp.mutateAsync({
            inspection_type: (v.inspection_type as string) || "in_process",
            status: (v.status as QcInspection["status"]) || "pending",
            inspector: (v.inspector as string) || null,
            sample_size: Number(v.sample_size ?? 1),
            defects_found: Number(v.defects_found ?? 0),
            notes: (v.notes as string) || null,
            inspected_at: v.status === "pass" || v.status === "fail" ? new Date().toISOString() : null,
          });
          setInspOpen(false);
        }}
      />

      <FormDialog
        open={ncrOpen} onOpenChange={setNcrOpen}
        title="Raise Non-Conformance"
        fields={[
          { name: "number", label: "NCR number", type: "text", required: true },
          { name: "severity", label: "Severity", type: "select", options: [
            { value: "minor", label: "Minor" }, { value: "major", label: "Major" }, { value: "critical", label: "Critical" },
          ]},
          { name: "raised_by", label: "Raised by", type: "text" },
          { name: "description", label: "Description", type: "textarea" },
          { name: "disposition", label: "Disposition", type: "text" },
        ]}
        onSubmit={async (v) => {
          await createNcr.mutateAsync({
            number: v.number as string,
            severity: (v.severity as NonConformance["severity"]) ?? "minor",
            raised_by: (v.raised_by as string) || null,
            description: (v.description as string) || null,
            disposition: (v.disposition as string) || null,
          });
          setNcrOpen(false);
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
