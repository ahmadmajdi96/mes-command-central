import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DataTable } from "@/components/page-shell";
import { AnalyticsCards } from "@/components/analytics-cards";
import { CSVExportButton } from "@/components/csv-export-button";
import { StatusPill } from "@/components/status-pill";
import { FormDialog, friendlyError } from "@/components/form-dialog";
import { useRealtimeInvalidate, useProducts } from "@/lib/oms-db";
import { usePermission } from "@/lib/permissions";
import { holdsKey, useBatchRefs, useHolds, useRemove, useSave, type QualityHold } from "@/lib/quality-db";

const meta = (t: string, d: string) => [
  { title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d },
  { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
];
export const Route = createFileRoute("/quality-holds")({
  head: () => ({ meta: meta("Quality Holds · OMS", "Put batches and lots on quality hold and release them with a recorded reason.") }),
  component: HoldsPage,
});

const QUEUES = ["Active", "Released", "All"] as const;

function HoldsPage() {
  useRealtimeInvalidate("quality_holds" as never, [holdsKey]);
  const { data: rows = [], isLoading } = useHolds();
  const { data: batches = [] } = useBatchRefs();
  const { data: products = [] } = useProducts();
  const save = useSave("quality_holds", [holdsKey, ["batches"]]);
  const del = useRemove("quality_holds", [holdsKey]);
  const canCreate = usePermission("quality_holds", "create");
  const canEdit = usePermission("quality_holds", "update");
  const [q, setQ] = useState<typeof QUEUES[number]>("Active");
  const [creating, setCreating] = useState(false);
  const [releasing, setReleasing] = useState<QualityHold | null>(null);
  const batch = (id: string | null) => batches.find((b) => b.id === id);
  const prod = (id: string | null) => products.find((p) => p.id === id);
  const filtered = rows.filter((r) => q === "All" || (q === "Active" ? r.status === "active" : r.status === "released"));
  const cards = useMemo(() => [
    { label: "Active holds", value: rows.filter((r) => r.status === "active").length, accent: "destructive" as const },
    { label: "From QC", value: rows.filter((r) => r.source === "qc").length, accent: "info" as const },
    { label: "Released", value: rows.filter((r) => r.status === "released").length, accent: "success" as const },
    { label: "Total", value: rows.length, accent: "primary" as const },
  ], [rows]);

  return (
    <div className="space-y-5">
      <PageHeader title="Quality Holds" subtitle={isLoading ? "Loading…" : "Held batches can't be completed until released"} actions={<>
        <CSVExportButton filename={`quality-holds-${q}`} rows={filtered} columns={[
          { key: "number", label: "Hold" }, { key: "batch", label: "Batch", get: (r) => batch(r.batch_id)?.number ?? "" }, { key: "lot_code", label: "Lot" },
          { key: "product", label: "Product", get: (r) => prod(r.product_id)?.sku ?? "" }, { key: "reason", label: "Reason" }, { key: "source", label: "Source" },
          { key: "status", label: "Status" }, { key: "release_reason", label: "Release reason" }, { key: "created_at", label: "Created" }, { key: "released_at", label: "Released" },
        ]} />
        {canCreate && <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary"><Plus className="h-3.5 w-3.5" /> New hold</button>}
      </>} />
      <AnalyticsCards cards={cards} />
      <div className="glass-panel flex flex-wrap gap-1 rounded-2xl p-3">
        {QUEUES.map((x) => <button key={x} onClick={() => setQ(x)} className={`rounded-lg px-2.5 py-1 text-[11px] ${q === x ? "border border-primary/30 bg-primary/15 text-primary" : "border border-transparent text-muted-foreground"}`}>{x}</button>)}
      </div>
      <DataTable<QualityHold> rows={filtered} defaultSort={{ key: "c", dir: "desc" }} empty="No holds in this list" columns={[
        { key: "number", label: "Hold", sortAccessor: (r) => r.number, render: (r) => <span className="font-mono text-xs">{r.number}</span> },
        { key: "b", label: "Batch / lot", render: (r) => { const b = batch(r.batch_id); return <span className="text-xs">{b ? <Link to="/batches/$batchId" params={{ batchId: b.id }} className="font-mono text-primary hover:underline">{b.number}</Link> : "—"}<span className="block text-[10px] text-muted-foreground">{r.lot_code ?? ""}</span></span>; } },
        { key: "p", label: "Product", render: (r) => <span className="text-xs">{prod(r.product_id)?.name ?? "—"}</span> },
        { key: "reason", label: "Reason", render: (r) => <span className="block max-w-xs text-xs">{r.reason}{r.release_reason && <span className="block text-[10px] text-success">Released: {r.release_reason}</span>}</span> },
        { key: "src", label: "Source", render: (r) => <span className="text-xs uppercase">{r.source}</span> },
        { key: "st", label: "Status", render: (r) => <StatusPill status={r.status} /> },
        { key: "c", label: "Created", sortAccessor: (r) => r.created_at, render: (r) => <span className="font-mono text-xs">{new Date(r.created_at).toLocaleString()}</span> },
        { key: "a", label: "", align: "right", render: (r) => <span className="flex justify-end gap-2 text-xs">
          {canEdit && r.status === "active" && <button className="text-success hover:underline" onClick={() => setReleasing(r)}>Release</button>}
          {r.status === "released" && <button className="text-destructive hover:underline" onClick={() => confirm(`Delete ${r.number}?`) && del.mutate(r.id)}>Delete</button>}
        </span> },
      ]} />
      <FormDialog open={creating} onOpenChange={setCreating} title="New quality hold" description="The batch is set to on hold and its production order can't be completed until every hold is released."
        fields={[
          { name: "batch_id", label: "Batch", type: "select", required: true, options: batches.filter((b) => b.status !== "on_hold").map((b) => ({ value: b.id, label: `${b.number}${b.lot_code ? ` · ${b.lot_code}` : ""}` })) },
          { name: "reason", label: "Reason", type: "textarea", required: true, placeholder: "e.g. Sample failed visual inspection" },
        ]}
        onSubmit={async (v) => { await save.mutateAsync({ batch_id: v.batch_id, reason: String(v.reason).trim() }); toast.success("Hold placed"); }} />
      <FormDialog open={!!releasing} onOpenChange={(o) => !o && setReleasing(null)} title={`Release ${releasing?.number ?? ""}`} submitLabel="Release"
        fields={[{ name: "release_reason", label: "Release reason", type: "textarea", required: true, placeholder: "e.g. Re-inspection passed, NCR-2026-0001 dispositioned use as is" }]}
        onSubmit={async (v) => {
          try { await save.mutateAsync({ id: releasing!.id, status: "released", release_reason: String(v.release_reason).trim() }); toast.success("Hold released"); }
          catch (e) { throw new Error(friendlyError(e)); }
        }} />
    </div>
  );
}
