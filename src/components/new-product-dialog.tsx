import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useStations } from "@/lib/product-routings-db";
import { productTypeOptions } from "@/lib/oms-db";

export type NewProductStep = {
  sequence: number;
  station_id: string;
  operation: string;
  notes: string;
};

export type NewProductValues = {
  sku: string;
  name: string;
  description: string;
  uom: string;
  type: string;
  standard_cost: number;
  lead_time: number;
  batching_limit: number;
  qc_specs: string;
  qc_category_id: string;
  send_to_qc: boolean;
  steps: NewProductStep[];
};

export function NewProductDialog({
  open, onOpenChange, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (v: NewProductValues) => Promise<void>;
}) {
  const { data: stations = [] } = useStations();
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState<NewProductValues>(seed());

  useEffect(() => { if (open) setV(seed()); }, [open]);

  const addStep = () => setV((s) => ({
    ...s,
    steps: [...s.steps, { sequence: s.steps.length + 1, station_id: "", operation: "", notes: "" }],
  }));
  const removeStep = (i: number) => setV((s) => ({
    ...s,
    steps: s.steps.filter((_, idx) => idx !== i).map((st, idx) => ({ ...st, sequence: idx + 1 })),
  }));
  const updateStep = (i: number, patch: Partial<NewProductStep>) => setV((s) => ({
    ...s,
    steps: s.steps.map((st, idx) => idx === i ? { ...st, ...patch } : st),
  }));
  const moveStep = (i: number, dir: -1 | 1) => setV((s) => {
    const j = i + dir;
    if (j < 0 || j >= s.steps.length) return s;
    const arr = [...s.steps];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return { ...s, steps: arr.map((st, idx) => ({ ...st, sequence: idx + 1 })) };
  });

  const submit = async () => {
    if (!v.sku.trim()) return toast.error("SKU is required");
    if (!v.name.trim()) return toast.error("Name is required");
    if (v.send_to_qc) {
      const seen = new Set<number>();
      for (const s of v.steps) {
        if (!s.station_id) return toast.error(`Step ${s.sequence}: station is required`);
        if (seen.has(s.sequence)) return toast.error(`Duplicate sequence ${s.sequence}`);
        seen.add(s.sequence);
      }
    }
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
            <TextField label="Standard cost" type="number" value={String(v.standard_cost)} onChange={(x) => setV((s) => ({ ...s, standard_cost: Number(x) || 0 }))} />
            <TextField label="Lead time (days)" type="number" value={String(v.lead_time)} onChange={(x) => setV((s) => ({ ...s, lead_time: Number(x) || 0 }))} />
            <TextField label="Batching limit (units / batch, 0 = none)" type="number" value={String(v.batching_limit)} onChange={(x) => setV((s) => ({ ...s, batching_limit: Number(x) || 0 }))} />
          </div>
          <TextAreaField label="Description" value={v.description} onChange={(x) => setV((s) => ({ ...s, description: x }))} />
          <TextAreaField label="QC specifications / acceptance criteria" value={v.qc_specs}
            onChange={(x) => setV((s) => ({ ...s, qc_specs: x }))} placeholder="Dimensions, tolerances, critical characteristics…" />

          <div className="glass-panel rounded-xl p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.send_to_qc}
                onChange={(e) => setV((s) => ({ ...s, send_to_qc: e.target.checked }))} />
              Send new-product request to CORTA QC
            </label>

            {v.send_to_qc && (
              <div className="mt-4 space-y-3">
                <TextField label="QC product category id (optional)" value={v.qc_category_id}
                  onChange={(x) => setV((s) => ({ ...s, qc_category_id: x }))}
                  placeholder="product_categories.id from CORTA QC" />

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                      QC Routing Steps ({v.steps.length})
                    </span>
                    <button type="button" onClick={addStep}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-primary">
                      <Plus className="h-3 w-3" /> Add Step
                    </button>
                  </div>
                  {v.steps.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                      No steps yet. Add QC steps to define the routing sent to QC.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {v.steps.map((s, i) => (
                        <div key={i} className="grid gap-2 rounded-lg border border-border/60 bg-card/40 p-2 md:grid-cols-[auto_1fr_1fr_1fr_auto]">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0}
                              className="text-muted-foreground hover:text-primary disabled:opacity-30">▲</button>
                            <span className="font-mono text-[10px] text-muted-foreground">{s.sequence}</span>
                            <button type="button" onClick={() => moveStep(i, 1)} disabled={i === v.steps.length - 1}
                              className="text-muted-foreground hover:text-primary disabled:opacity-30">▼</button>
                          </div>
                          <select value={s.station_id} onChange={(e) => updateStep(i, { station_id: e.target.value })}
                            className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs">
                            <option value="">— station —</option>
                            {stations.map((st) => (
                              <option key={st.id} value={st.id}>{st.station_code} — {st.name}</option>
                            ))}
                          </select>
                          <input value={s.operation} onChange={(e) => updateStep(i, { operation: e.target.value })}
                            placeholder="Operation" className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs" />
                          <input value={s.notes} onChange={(e) => updateStep(i, { notes: e.target.value })}
                            placeholder="Notes" className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs" />
                          <button type="button" onClick={() => removeStep(i)}
                            className="rounded-md border border-destructive/40 bg-destructive/10 p-1.5 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
    standard_cost: 0, lead_time: 0, batching_limit: 0, qc_specs: "", qc_category_id: "",
    send_to_qc: true, steps: [],
  };
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
