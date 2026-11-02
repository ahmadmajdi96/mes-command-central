import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DataTable, Panel } from "@/components/page-shell";
import { AnalyticsCards } from "@/components/analytics-cards";
import { CSVExportButton } from "@/components/csv-export-button";
import { StatusPill } from "@/components/status-pill";
import { FormDialog, friendlyError } from "@/components/form-dialog";
import { inputCls, ThemedSelect } from "@/components/ui/form-controls";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { usePermission } from "@/lib/permissions";
import { capaCloseBlockers, capaKey, isCapaOverdue, useCapaActions, useCapaLinks, useCapas, useLinkNcr, useNcrs, useRemove, useSave, type Capa } from "@/lib/quality-db";

export const Route = createFileRoute("/capa")({
  head: () => ({ meta: [
    { title: "CAPA · OMS" },
    { name: "description", content: "Corrective and preventive actions with root cause, owners, due dates and effectiveness checks." },
    { property: "og:title", content: "CAPA · OMS" },
    { property: "og:description", content: "Corrective and preventive actions with root cause, owners, due dates and effectiveness checks." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CapaPage,
});

const QUEUES = ["Open", "Overdue", "Verification", "Closed", "All"] as const;
const STATUS = [{ value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "verification", label: "Verification" }, { value: "closed", label: "Closed" }];

function CapaPage() {
  useRealtimeInvalidate("capas" as never, [capaKey]);
  useRealtimeInvalidate("capa_actions" as never, [capaKey]);
  const { data: rows = [], isLoading } = useCapas();
  const { data: actions = [] } = useCapaActions();
  const save = useSave("capas", [capaKey]);
  const del = useRemove("capas", [capaKey]);
  const canCreate = usePermission("capa", "create");
  const canDelete = usePermission("capa", "delete");
  const [q, setQ] = useState<typeof QUEUES[number]>("Open");
  const [edit, setEdit] = useState<Partial<Capa> | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const test: Record<typeof QUEUES[number], (r: Capa) => boolean> = {
    Open: (r) => r.status !== "closed", Overdue: (r) => isCapaOverdue(r), Verification: (r) => r.status === "verification", Closed: (r) => r.status === "closed", All: () => true,
  };
  const filtered = rows.filter(test[q]);
  const acts = (id: string) => actions.filter((a) => a.capa_id === id);
  const cards = useMemo(() => [
    { label: "Open", value: rows.filter(test.Open).length, accent: "primary" as const },
    { label: "Overdue", value: rows.filter(test.Overdue).length, accent: "destructive" as const },
    { label: "In verification", value: rows.filter(test.Verification).length, accent: "warning" as const },
    { label: "Open actions", value: actions.filter((a) => !a.done).length, accent: "info" as const },
    { label: "Closed", value: rows.filter(test.Closed).length, accent: "success" as const },
  ], [rows, actions]);
  const current = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader title="CAPA" subtitle={isLoading ? "Loading…" : "Corrective and preventive actions"} actions={<>
        <CSVExportButton filename={`capa-${q}`} rows={filtered} columns={[
          { key: "number", label: "CAPA" }, { key: "title", label: "Title" }, { key: "status", label: "Status" }, { key: "owner", label: "Owner" }, { key: "due_date", label: "Due" },
          { key: "root_cause", label: "Root cause" }, { key: "actions", label: "Actions done", get: (r) => `${acts(r.id).filter((a) => a.done).length}/${acts(r.id).length}` },
          { key: "effectiveness_verified", label: "Effectiveness verified" }, { key: "closed_at", label: "Closed" },
        ]} />
        {canCreate && <button onClick={() => setEdit({})} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary"><Plus className="h-3.5 w-3.5" /> New CAPA</button>}
      </>} />
      <AnalyticsCards cards={cards} />
      <div className="glass-panel flex flex-wrap gap-1 rounded-2xl p-3">
        {QUEUES.map((x) => <button key={x} onClick={() => setQ(x)} className={`rounded-lg px-2.5 py-1 text-[11px] ${q === x ? "border border-primary/30 bg-primary/15 text-primary" : "border border-transparent text-muted-foreground"}`}>{x}</button>)}
      </div>
      <DataTable<Capa> rows={filtered} defaultSort={{ key: "due", dir: "asc" }} empty="No CAPAs in this list" columns={[
        { key: "number", label: "CAPA", sortAccessor: (r) => r.number, render: (r) => <button onClick={() => setOpenId(r.id)} className="font-mono text-xs text-primary hover:underline">{r.number}</button> },
        { key: "t", label: "Title", render: (r) => <span className="text-xs">{r.title}</span> },
        { key: "st", label: "Status", render: (r) => <StatusPill status={r.status} /> },
        { key: "o", label: "Owner", render: (r) => <span className="text-xs">{r.owner ?? "—"}</span> },
        { key: "due", label: "Due", sortAccessor: (r) => r.due_date ?? "9999", render: (r) => <span className={`font-mono text-xs ${isCapaOverdue(r) ? "text-destructive" : ""}`}>{r.due_date ?? "—"}</span> },
        { key: "act", label: "Actions", render: (r) => { const a = acts(r.id); return <span className="font-mono text-xs">{a.filter((x) => x.done).length}/{a.length}</span>; } },
        { key: "a", label: "", align: "right", render: (r) => <span className="flex justify-end gap-2 text-xs">
          <button className="text-primary hover:underline" onClick={() => setOpenId(r.id)}>Open</button>
          {canDelete && <button className="text-destructive hover:underline" onClick={() => confirm(`Delete ${r.number}?`) && del.mutate(r.id)}>Delete</button>}
        </span> },
      ]} />
      {current && <CapaDetail capa={current} onClose={() => setOpenId(null)} onEdit={() => setEdit(current)} />}
      <FormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} wide title={edit?.id ? `Edit ${edit.number}` : "New CAPA"}
        description="To close: record the root cause, finish every action and verify effectiveness."
        initial={{ ...edit, status: edit?.status ?? "open" } as never}
        fields={[
          { name: "title", label: "Title", required: true },
          { name: "problem", label: "Problem statement", type: "textarea" },
          { name: "root_cause", label: "Root cause", type: "textarea" },
          { name: "owner", label: "Owner" },
          { name: "due_date", label: "Due date", type: "date" },
          { name: "effectiveness_check", label: "Effectiveness check", type: "textarea", placeholder: "How you confirmed the problem no longer happens" },
          { name: "verified_by", label: "Verified by" },
          { name: "effectiveness_verified", label: "Effectiveness verified?", type: "select", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
          { name: "status", label: "Status", type: "select", required: true, options: STATUS },
        ]}
        onSubmit={async (v) => {
          const row = {
            id: edit?.id, title: String(v.title).trim(), problem: v.problem || null, root_cause: v.root_cause || null, owner: v.owner || null, due_date: v.due_date || null,
            effectiveness_check: v.effectiveness_check || null, verified_by: v.verified_by || null,
            effectiveness_verified: v.effectiveness_verified === "yes" || (v.effectiveness_verified === "" && !!edit?.effectiveness_verified), status: v.status,
          };
          if (row.status === "closed") {
            const blockers = capaCloseBlockers(row, edit?.id ? acts(edit.id) : []);
            if (blockers.length) throw new Error(`Can't close yet: ${blockers.join(", ")}.`);
          }
          await save.mutateAsync(row); toast.success("Saved");
        }} />
    </div>
  );
}

function CapaDetail({ capa, onClose, onEdit }: { capa: Capa; onClose: () => void; onEdit: () => void }) {
  const { data: actions = [] } = useCapaActions();
  const { data: links = [] } = useCapaLinks();
  const { data: ncrs = [] } = useNcrs();
  const saveAct = useSave("capa_actions", [capaKey]);
  const delAct = useRemove("capa_actions", [capaKey]);
  const link = useLinkNcr();
  const canEdit = usePermission("capa", "update");
  const mine = actions.filter((a) => a.capa_id === capa.id);
  const linked = links.filter((l) => l.capa_id === capa.id).map((l) => l.ncr_id);
  const [desc, setDesc] = useState(""); const [kind, setKind] = useState("corrective"); const [owner, setOwner] = useState(""); const [due, setDue] = useState("");
  const [ncrPick, setNcrPick] = useState("");
  const blockers = capaCloseBlockers(capa, mine);
  const add = async () => {
    if (!desc.trim()) { toast.error("Describe the action"); return; }
    try { await saveAct.mutateAsync({ capa_id: capa.id, kind, description: desc.trim(), owner: owner || null, due_date: due || null }); setDesc(""); setOwner(""); setDue(""); }
    catch (e) { toast.error(friendlyError(e)); }
  };
  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold"><span className="font-mono">{capa.number}</span> · {capa.title} <StatusPill status={capa.status} /></h3>
        <span className="flex gap-3 text-xs">{canEdit && <button className="text-primary hover:underline" onClick={onEdit}>Edit</button>}<button className="text-muted-foreground" onClick={onClose}>Close</button></span>
      </div>
      <div className="grid gap-3 text-xs md:grid-cols-3">
        <div><div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Problem</div><p className="mt-1 whitespace-pre-wrap">{capa.problem ?? "—"}</p></div>
        <div><div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Root cause</div><p className="mt-1 whitespace-pre-wrap">{capa.root_cause ?? "—"}</p></div>
        <div><div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Effectiveness</div><p className="mt-1 whitespace-pre-wrap">{capa.effectiveness_check ?? "—"}{capa.effectiveness_verified ? ` (verified${capa.verified_by ? ` by ${capa.verified_by}` : ""})` : " (not verified)"}</p></div>
      </div>
      {capa.status !== "closed" && blockers.length > 0 && <p className="mt-3 text-[11px] text-warning">Before closing: {blockers.join(" · ")}</p>}
      <h4 className="mb-2 mt-4 text-xs font-semibold">Actions</h4>
      <div className="space-y-1">
        {mine.length === 0 && <p className="text-xs text-muted-foreground">No actions yet.</p>}
        {mine.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs">
            <input type="checkbox" aria-label={`Done: ${a.description}`} checked={a.done} disabled={!canEdit} onChange={(e) => saveAct.mutate({ id: a.id, done: e.target.checked })} />
            <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${a.kind === "corrective" ? "bg-warning/10 text-warning" : "bg-info/10 text-info"}`}>{a.kind}</span>
            <span className={`flex-1 ${a.done ? "text-muted-foreground line-through" : ""}`}>{a.description}</span>
            <span className="text-muted-foreground">{a.owner ?? ""}{a.due_date ? ` · due ${a.due_date}` : ""}</span>
            {canEdit && <button aria-label="Delete action" onClick={() => delAct.mutate(a.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="mt-2 grid gap-2 md:grid-cols-[140px_1fr_160px_150px_auto]">
          <ThemedSelect value={kind} onChange={setKind} allowEmpty={false} options={[{ value: "corrective", label: "Corrective" }, { value: "preventive", label: "Preventive" }]} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What will be done" className={inputCls} />
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" className={inputCls} />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
          <button onClick={add} className="rounded-lg bg-primary px-3 text-xs text-primary-foreground">Add</button>
        </div>
      )}
      <h4 className="mb-2 mt-4 text-xs font-semibold">Linked nonconformance reports</h4>
      <div className="flex flex-wrap gap-1.5">
        {linked.length === 0 && <span className="text-xs text-muted-foreground">None linked.</span>}
        {linked.map((id) => { const n = ncrs.find((x) => x.id === id); return (
          <span key={id} className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-0.5 font-mono text-[11px]">{n?.number ?? id.slice(0, 8)}
            {canEdit && <button aria-label="Unlink" onClick={() => link.mutate({ capa_id: capa.id, ncr_id: id, link: false })} className="text-destructive">×</button>}</span>
        ); })}
      </div>
      {canEdit && (
        <div className="mt-2 flex max-w-md gap-2">
          <ThemedSelect value={ncrPick} onChange={setNcrPick} options={ncrs.filter((n) => !linked.includes(n.id)).map((n) => ({ value: n.id, label: `${n.number} · ${n.title}` }))} placeholder="Link an NCR…" />
          <button disabled={!ncrPick} onClick={() => { link.mutate({ capa_id: capa.id, ncr_id: ncrPick, link: true }); setNcrPick(""); }} className="rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs text-primary disabled:opacity-50">Link</button>
        </div>
      )}
    </Panel>
  );
}
