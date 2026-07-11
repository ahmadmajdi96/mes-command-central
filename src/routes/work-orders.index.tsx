import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SavedPresetsBar } from "@/components/saved-presets-bar";
import { FormDialog } from "@/components/form-dialog";
import { useStore } from "@/lib/store";
import { permissionsFor } from "@/lib/roles";
import { toast } from "sonner";
import {
  useWorkOrders, useCreateWorkOrder, useBulkWorkOrderAction, useRealtimeInvalidate,
  workOrdersKey, workOrderStatusOptions, type WorkOrder,
} from "@/lib/oms-db";

export const Route = createFileRoute("/work-orders/")({
  head: () => ({ meta: [{ title: "Work Orders · CORTA OMS" }] }),
  component: WOList,
});

type WOPreset = { q: string; status: string };
type BulkFn = "start" | "pause" | "resume" | "complete";

function WOList() {
  const role = useStore((s) => s.role);
  const perms = permissionsFor(role);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [openNew, setOpenNew] = useState(false);
  const [confirm, setConfirm] = useState<{ ids: string[]; clear: () => void; fn: BulkFn; label: string; variant?: "destructive" } | null>(null);

  useRealtimeInvalidate("work_orders", [workOrdersKey]);
  const { data: workOrders = [], isLoading } = useWorkOrders();
  const createWO = useCreateWorkOrder();
  const bulk = useBulkWorkOrderAction();

  const filters = ["all", ...workOrderStatusOptions];
  const filtered = useMemo(() => workOrders.filter((w) => {
    if (status !== "all" && w.status !== status) return false;
    if (q) return w.number.toLowerCase().includes(q.toLowerCase()) || w.operation.toLowerCase().includes(q.toLowerCase());
    return true;
  }), [q, status, workOrders]);

  const runBulk = async () => {
    if (!confirm) return;
    try {
      await bulk.mutateAsync({ ids: confirm.ids, action: confirm.fn });
      toast.success(`${confirm.label} · ${confirm.ids.length} work order(s)`);
      confirm.clear();
      setConfirm(null);
    } catch (e: any) { toast.error(e.message ?? "Bulk action failed"); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Work Orders"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${workOrders.length}`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="work-orders" rows={filtered}
              columns={[
                { key: "number", label: "WO #" },
                { key: "operation", label: "Operation" },
                { key: "production_order_ref", label: "Production Order" },
                { key: "workstation", label: "Workstation" },
                { key: "status", label: "Status" },
                { key: "qty_target", label: "Target" },
                { key: "qty_produced", label: "Produced" },
                { key: "qty_scrap", label: "Scrap" },
                { key: "progress", label: "Progress %" },
                { key: "labor_min", label: "Labor Min" },
              ]}
            />
            {perms.releasePO && (
              <button onClick={() => setOpenNew(true)}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
                <Plus className="h-3.5 w-3.5" /> New Work Order
              </button>
            )}
          </div>
        }
      />

      <SavedPresetsBar<WOPreset> pageKey="work-orders" current={{ q, status }}
        onApply={(p) => { setQ(p.q ?? ""); setStatus(p.status ?? "all"); }} />

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search WO # or operation…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1">
          {filters.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${status === s ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>
      <DataTable<WorkOrder>
        rows={filtered}
        getRowId={(w) => w.id}
        defaultSort={{ key: "num", dir: "asc" }}
        empty={isLoading ? "Loading…" : "No work orders yet"}
        bulkActions={perms.operateWO ? (selected, clear) => {
          const ids = selected.map((w) => w.id);
          return (
            <>
              <button onClick={() => setConfirm({ ids, clear, fn: "start", label: "Start work orders" })}
                className="rounded-md border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] text-success hover:bg-success/20">Start</button>
              <button onClick={() => setConfirm({ ids, clear, fn: "pause", label: "Pause work orders" })}
                className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] text-warning hover:bg-warning/20">Pause</button>
              <button onClick={() => setConfirm({ ids, clear, fn: "resume", label: "Resume work orders" })}
                className="rounded-md border border-info/40 bg-info/10 px-2.5 py-1 text-[11px] text-info hover:bg-info/20">Resume</button>
              <button onClick={() => setConfirm({ ids, clear, fn: "complete", label: "Complete work orders" })}
                className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/20">Complete</button>
              <CSVExportButton filename="work-orders-selection" rows={selected} label="Export selection"
                columns={[
                  { key: "number", label: "WO #" },
                  { key: "operation", label: "Operation" },
                  { key: "status", label: "Status" },
                  { key: "progress", label: "Progress %" },
                ]} />
            </>
          );
        } : undefined}
        columns={[
          { key: "num", label: "WO", sortAccessor: (w) => w.number, render: (w) => (
            <Link to="/work-orders/$woId" params={{ woId: w.id }} className="font-mono text-xs text-primary hover:underline">{w.number}</Link>
          )},
          { key: "op", label: "Operation", sortAccessor: (w) => w.operation, render: (w) => <span className="text-sm">{w.operation}</span> },
          { key: "po", label: "PO Ref", sortAccessor: (w) => w.production_order_ref ?? "", render: (w) => <span className="font-mono text-xs text-muted-foreground">{w.production_order_ref ?? "—"}</span> },
          { key: "ws", label: "Workstation", sortAccessor: (w) => w.workstation ?? "", render: (w) => <span className="text-xs">{w.workstation ?? "—"}</span> },
          { key: "qty", label: "Qty", sortAccessor: (w) => Number(w.qty_produced), render: (w) => <span className="font-mono text-xs">{w.qty_produced}/{w.qty_target}</span> },
          { key: "prog", label: "Progress", sortAccessor: (w) => w.progress, render: (w) => (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-gradient-to-r from-primary to-info" style={{ width: `${w.progress}%` }} />
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">{w.progress}%</span>
            </div>
          )},
          { key: "status", label: "Status", sortAccessor: (w) => w.status, render: (w) => <StatusPill status={w.status} /> },
        ]}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={confirm?.label ?? ""}
        description={confirm ? `This will apply to ${confirm.ids.length} work order(s) and log an audit entry for each.` : ""}
        confirmLabel="Apply"
        onConfirm={runBulk}
      />

      <FormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        title="New Work Order"
        submitLabel="Create WO"
        fields={[
          { name: "number", label: "WO #", required: true, placeholder: "WO-0900" },
          { name: "operation", label: "Operation", required: true, placeholder: "Casting" },
          { name: "production_order_ref", label: "Production Order Ref" },
          { name: "workstation", label: "Workstation" },
          { name: "seq", label: "Sequence", type: "number" },
          { name: "qty_target", label: "Target qty", type: "number" },
          { name: "status", label: "Status", type: "select",
            options: workOrderStatusOptions.map((s) => ({ value: s, label: s })) },
        ]}
        onSubmit={async (v: any) => {
          await createWO.mutateAsync({
            number: v.number, operation: v.operation,
            production_order_ref: v.production_order_ref || null,
            workstation: v.workstation || null,
            seq: v.seq || 10, qty_target: v.qty_target || 0,
            status: v.status || "pending",
          });
          toast.success("Work order created");
        }}
      />
    </div>
  );
}
