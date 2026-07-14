import { useState, useEffect } from "react";
import { Plus, Trash2, Upload, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { productTypeOptions } from "@/lib/oms-db";
import type { ProductAttachment } from "@/lib/product-attachments";

export type NewProductValues = {
  sku: string;
  name: string;
  description: string;
  uom: string;
  type: string;
  standard_cost: number;
  sale_price: number;
  lead_time: number;
  batching_limit: number;
  specifications: string[];
  acceptance_criteria: string[];
  files: File[];
};

export function NewProductDialog({
  open, onOpenChange, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: NewProductValues) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<NewProductValues>(seed());
  const [specDraft, setSpecDraft] = useState("");
  const [critDraft, setCritDraft] = useState("");

  useEffect(() => { if (open) { setV(seed()); setSpecDraft(""); setCritDraft(""); } }, [open]);

  const addSpec = () => {
    const t = specDraft.trim();
    if (!t) return;
    setV((s) => ({ ...s, specifications: [...s.specifications, t] }));
    setSpecDraft("");
  };
  const addCrit = () => {
    const t = critDraft.trim();
    if (!t) return;
    setV((s) => ({ ...s, acceptance_criteria: [...s.acceptance_criteria, t] }));
    setCritDraft("");
  };
  const rmSpec = (i: number) => setV((s) => ({ ...s, specifications: s.specifications.filter((_, idx) => idx !== i) }));
  const rmCrit = (i: number) => setV((s) => ({ ...s, acceptance_criteria: s.acceptance_criteria.filter((_, idx) => idx !== i) }));
  const rmFile = (i: number) => setV((s) => ({ ...s, files: s.files.filter((_, idx) => idx !== i) }));

  const submit = async () => {
    if (!v.sku.trim()) return toast.error("SKU is required");
    if (!v.name.trim()) return toast.error("Name is required");
    if (!(v.sale_price >= 0) || Number.isNaN(v.sale_price)) return toast.error("Sale price must be non-negative");
    if (!(v.standard_cost >= 0)) return toast.error("Standard cost must be non-negative");
    if (!Number.isInteger(v.batching_limit) || v.batching_limit < 0) return toast.error("Batching limit must be a non-negative whole number");
    try {
      setBusy(true);
      await onSubmit(v);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="SKU *" value={v.sku} onChange={(x) => setV((s) => ({ ...s, sku: x }))} placeholder="VLV-8-CS" />
            <TextField label="Name *" value={v.name} onChange={(x) => setV((s) => ({ ...s, name: x }))} />
            <TextField label="UOM" value={v.uom} onChange={(x) => setV((s) => ({ ...s, uom: x }))} placeholder="EA" />
            <SelectField label="Type" value={v.type} onChange={(x) => setV((s) => ({ ...s, type: x }))}
              options={productTypeOptions.map((t) => ({ value: t, label: t }))} />
            <TextField label="Standard cost" type="number" value={String(v.standard_cost)} onChange={(x) => setV((s) => ({ ...s, standard_cost: Math.max(0, Number(x) || 0) }))} />
            <TextField label="Sale price" type="number" value={String(v.sale_price)} onChange={(x) => setV((s) => ({ ...s, sale_price: Math.max(0, Number(x) || 0) }))} />
            <TextField label="Lead time (days)" type="number" value={String(v.lead_time)} onChange={(x) => setV((s) => ({ ...s, lead_time: Math.max(0, Number(x) || 0) }))} />
            <TextField label="Batching limit" type="number" value={String(v.batching_limit)} onChange={(x) => setV((s) => ({ ...s, batching_limit: Math.max(0, Math.floor(Number(x) || 0)) }))} />
          </div>
          <TextAreaField label="Description" value={v.description} onChange={(x) => setV((s) => ({ ...s, description: x }))} />

          <ListEditor
            label="Specifications"
            items={v.specifications}
            draft={specDraft}
            setDraft={setSpecDraft}
            onAdd={addSpec}
            onRemove={rmSpec}
            placeholder="e.g. Body material: cast steel A216 WCB"
          />

          <ListEditor
            label="Acceptance criteria"
            items={v.acceptance_criteria}
            draft={critDraft}
            setDraft={setCritDraft}
            onAdd={addCrit}
            onRemove={rmCrit}
            placeholder="e.g. Hydrostatic test at 1.5× design pressure"
          />

          <FileUploader files={v.files} onAdd={(fs) => setV((s) => ({ ...s, files: [...s.files, ...fs] }))} onRemove={rmFile} />

          <p className="text-[11px] text-muted-foreground">A request will be created and delivered to EMS automatically.</p>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary disabled:opacity-50">
            {busy ? "Saving…" : "Create product"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function seed(): NewProductValues {
  return {
    sku: "", name: "", description: "", uom: "EA", type: "finished",
    standard_cost: 0, sale_price: 0, lead_time: 0, batching_limit: 0,
    specifications: [], acceptance_criteria: [], files: [],
  };
}

export function ListEditor({
  label, items, draft, setDraft, onAdd, onRemove, placeholder,
}: {
  label: string;
  items: string[];
  draft: string;
  setDraft: (v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  placeholder?: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-3">
      <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
      <div className="mt-2 flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          placeholder={placeholder}
          className="h-9 flex-1 rounded-lg border border-border/60 bg-card/60 px-2 text-sm focus:border-primary/50 focus:outline-none" />
        <button type="button" onClick={onAdd}
          className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-start justify-between gap-2 rounded-lg border border-border/40 bg-card/40 px-2 py-1.5 text-sm">
              <span className="flex-1">{it}</span>
              <button type="button" onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FileUploader({
  files, onAdd, onRemove, existing, onRemoveExisting,
}: {
  files: File[];
  onAdd: (fs: File[]) => void;
  onRemove: (i: number) => void;
  existing?: ProductAttachment[];
  onRemoveExisting?: (path: string) => void;
}) {
  return (
    <div className="glass-panel rounded-xl p-3">
      <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Attachments</label>
      <div className="mt-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground">
          <Upload className="h-3.5 w-3.5" />
          <span>Click to upload files (multiple)</span>
          <input type="file" multiple className="hidden"
            onChange={(e) => {
              const list = e.target.files ? Array.from(e.target.files) : [];
              if (list.length) onAdd(list);
              e.currentTarget.value = "";
            }} />
        </label>
      </div>
      {(existing?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1">
          {existing!.map((a) => (
            <li key={a.path} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-card/40 px-2 py-1.5 text-xs">
              <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-primary" />{a.name}<span className="text-muted-foreground">({Math.round(a.size / 1024)} KB)</span></span>
              {onRemoveExisting && (
                <button type="button" onClick={() => onRemoveExisting(a.path)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-card/40 px-2 py-1.5 text-xs">
              <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" />{f.name}<span className="text-muted-foreground">({Math.round(f.size / 1024)} KB)</span></span>
              <button type="button" onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm focus:border-primary/50 focus:outline-none" />
    </div>
  );
}
function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-border/60 bg-card/60 p-2 text-sm focus:border-primary/50 focus:outline-none" />
    </div>
  );
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm focus:border-primary/50 focus:outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
