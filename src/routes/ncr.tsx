import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DataTable } from "@/components/page-shell";
import { AnalyticsCards } from "@/components/analytics-cards";
import { CSVExportButton } from "@/components/csv-export-button";
import { StatusPill } from "@/components/status-pill";
import { FormDialog } from "@/components/form-dialog";
import { useRealtimeInvalidate, useProducts } from "@/lib/oms-db";
import { usePermission } from "@/lib/permissions";
import { ncrKey, useBatchRefs, useNcrs, useRemove, useSave, type Ncr } from "@/lib/quality-db";

export const Route = createFileRoute("/ncr")({
  head: () => ({ meta: [
    { title: "Nonconformance · OMS" },
    { name: "description", content: "Record nonconforming batches, returns and QC results, and decide their disposition." },
    { property: "og:title", content: "Nonconformance · OMS" },
    { property: "og:description", content: "Record nonconforming batches, returns and QC results, and decide their disposition." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: NcrPage,
});

const QUEUES = ["Open", "Critical / major", "Closed", "All"] as const;
const SEV = [{ value: "minor", label: "Minor" }, { value: "major", label: "Major" }, { value: "critical", label: "Critical" }];
const DISP = [{ value: "use_as_is", label: "Use as is" }, { value: "rework", label: "Rework" }, { value: "scrap", label: "Scrap" }, { value: "return_to_supplier", label: "Return to supplier" }];
const STATUS = [{ value: "open", label: "Open" }, { value: "investigating", label: "Investigating" }, { value: "dispositioned", label: "Dispositioned" }, { value: "closed", label: "Closed" }];
const SRC = [{ value: "manual", label: "Manual" }, { value: "batch", label: "Batch" }, { value: "return", label: "Return" }, { value: "qc", label: "QC result" }];
const sevColor: Record<string, string> = { minor: "text-info", major: "text-warning", critical: "text-destructive" };

function NcrPage() {
  useRealtimeInvalidate("ncr_reports" as never, [ncrKey]);
  const { data: rows = [], isLoading } = useNcrs();
  const { data: batches = [] } = useBatchRefs();
  const { data: products = [] } = useProducts();
  const save = useSave("ncr_reports", [ncrKey]);
  const del = useRemove("ncr_reports", [ncrKey]);
  const canCreate = usePermission("ncr", "create");
  const canEdit = usePermission("ncr", "update");
  const canDelete = usePermission("ncr", "delete");
  const [q, setQ] = useState<typeof QUEUES[number]>("Open");
  const [edit, setEdit] = useState<Partial<Ncr> | null>(null);
  const isOpen = (r: Ncr) => r.status !== "closed";
  const test: Record<typeof QUEUES[number], (r: Ncr) => boolean> = {
    Open: isOpen, "Critical / major": (r) => isOpen(r) && r.severity !== "minor", Closed: (r) => !isOpen(r), All: () => true,
  };
  const filtered = rows.filter(test[q]);
  const cards = useMemo(() => [
    { label: "Open", value: rows.filter(isOpen).length, accent: "primary" as const },
    { label: "Critical open", value: rows.filter((r) => isOpen(r) && r.severity === "critical").length, accent: "destructive" as const },
    { label: "Awaiting disposition", value: rows.filter((r) => isOpen(r) && !r.disposition).length, accent: "warning" as const },
    { label: "Scrapped", value: rows.filter((r) => r.disposition === "scrap").length, accent: "info" as const },
    { label: "Closed", value: rows.filter((r) => !isOpen(r)).length, accent: "success" as const },
  ], [rows]);
  const batch = (id: string | null) => batches.find((b) => b.id === id);
  const prod = (id: string | null) => products.find((p) => p.id === id);

  return (
    <div className="space-y-5">
      <PageHeader title="Nonconformance" subtitle={isLoading ? "Loading…" : `${rows.filter(isOpen).length} open reports`} actions={<>
        <CSVExportButton filename={`ncr-${q}`} rows={filtered} columns={[
          { key: "number", label: "NCR" }, { key: "title", label: "Title" }, { key: "severity", label: "Severity" }, { key: "status", label: "Status" },
          { key: "disposition", label: "Disposition" }, { key: "source", label: "Source" }, { key: "batch", label: "Batch", get: (r) => batch(r.batch_id)?.number ?? "" },
          { key: "product", label: "Product", get: (r) => prod(r.product_id)?.sku ?? "" }, { key: "qty_affected", label: "Qty affected" }, { key: "owner", label: "Owner" }, { key: "created_at", label: "Created" },
        ]} />
        {canCreate && <button onClick={() => setEdit({})} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary"><Plus className="h-3.5 w-3.5" /> New NCR</button>}
      </>} />
      <AnalyticsCards cards={cards} />
      <div className="glass-panel flex flex-wrap gap-1 rounded-2xl p-3">
        {QUEUES.map((x) => <button key={x} onClick={() => setQ(x)} className={`rounded-lg px-2.5 py-1 text-[11px] ${q === x ? "border border-primary/30 bg-primary/15 text-primary" : "border border-transparent text-muted-foreground"}`}>{x}</button>)}
      </div>
      <DataTable<Ncr> rows={filtered} defaultSort={{ key: "c", dir: "desc" }} empty="No reports in this list" columns={[
        { key: "number", label: "NCR", sortAccessor: (r) => r.number, render: (r) => <button onClick={() => setEdit(r)} className="font-mono text-xs text-primary hover:underline">{r.number}</button> },
        { key: "t", label: "Title", render: (r) => <span className="text-xs">{r.title}<span className="block text-[10px] uppercase text-muted-foreground">{r.source}</span></span> },
        { key: "b", label: "Batch / product", render: (r) => <span className="text-xs font-mono">{batch(r.batch_id)?.number ?? "—"}<span className="block font-sans text-[10px] text-muted-foreground">{prod(r.product_id)?.name ?? ""}</span></span> },
        { key: "sev", label: "Severity", sortAccessor: (r) => ["minor", "major", "critical"].indexOf(r.severity), render: (r) => <span className={`text-xs font-medium capitalize ${sevColor[r.severity]}`}>{r.severity}</span> },
        { key: "d", label: "Disposition", render: (r) => <span className="text-xs">{DISP.find((d) => d.value === r.disposition)?.label ?? <span className="text-warning">Pending</span>}</span> },
        { key: "st", label: "Status", render: (r) => <StatusPill status={r.status} /> },
        { key: "o", label: "Owner", render: (r) => <span className="text-xs">{r.owner ?? "—"}</span> },
        { key: "c", label: "Created", sortAccessor: (r) => r.created_at, render: (r) => <span className="font-mono text-xs">{new Date(r.created_at).toLocaleDateString()}</span> },
        { key: "a", label: "", align: "right", render: (r) => <span className="flex justify-end gap-2 text-xs">
          {canEdit && <button className="text-primary hover:underline" onClick={() => setEdit(r)}>Edit</button>}
          {canDelete && <button className="text-destructive hover:underline" onClick={() => confirm(`Delete ${r.number}?`) && del.mutate(r.id)}>Delete</button>}
        </span> },
      ]} />
      <FormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} wide
        title={edit?.id ? `Edit ${edit.number}` : "New nonconformance report"}
        description="Closing requires a disposition."
        initial={{ ...edit, qty_affected: edit?.qty_affected ?? "", severity: edit?.severity ?? "minor", status: edit?.status ?? "open", source: edit?.source ?? "manual" } as never}
        fields={[
          { name: "title", label: "Title", required: true, placeholder: "e.g. Seal leak on filled cans" },
          { name: "description", label: "Description", type: "textarea" },
          { name: "source", label: "Found in", type: "select", required: true, options: SRC },
          { name: "batch_id", label: "Batch", type: "select", options: batches.map((b) => ({ value: b.id, label: b.number })) },
          { name: "product_id", label: "Product", type: "select", options: products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` })) },
          { name: "severity", label: "Severity", type: "select", required: true, options: SEV },
          { name: "qty_affected", label: "Quantity affected", type: "number" },
          { name: "disposition", label: "Disposition", type: "select", options: DISP },
          { name: "owner", label: "Owner", placeholder: "Name of the person responsible" },
          { name: "status", label: "Status", type: "select", required: true, options: STATUS },
        ]}
        onSubmit={async (v) => {
          const b = batches.find((x) => x.id === v.batch_id);
          await save.mutateAsync({
            id: edit?.id, title: String(v.title).trim(), description: v.description || null, source: v.source, severity: v.severity,
            batch_id: v.batch_id || null, product_id: v.product_id || b?.product_id || null, production_order_id: b?.production_order_id ?? edit?.production_order_id ?? null,
            qty_affected: v.qty_affected === "" ? null : Number(v.qty_affected), disposition: v.disposition || null, owner: v.owner || null, status: v.status,
          });
          toast.success("Saved");
        }} />
    </div>
  );
}
