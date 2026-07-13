import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
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
  sale_price: number;
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
    if (!(v.sale_price >= 0) || Number.isNaN(v.sale_price)) return toast.error("Sale price must be a non-negative number");
    if (!(v.standard_cost >= 0)) return toast.error("Standard cost must be a non-negative number");
    if (!Number.isInteger(v.batching_limit) || v.batching_limit < 0) {
      return toast.error("Batching limit must be a non-negative whole number");
    }
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
            <TextField label="Standard cost" type="number" value={String(v.standard_cost)} onChange={(x) => setV((s) => ({ ...s, standard_cost: Math.max(0, Number(x) || 0) }))} />
            <TextField label="Sale price" type="number" value={String(v.sale_price)} onChange={(x) => setV((s) => ({ ...s, sale_price: Math.max(0, Number(x) || 0) }))} />
            <TextField label="Lead time (days)" type="number" value={String(v.lead_time)} onChange={(x) => setV((s) => ({ ...s, lead_time: Math.max(0, Number(x) || 0) }))} />
            <TextField label="Batching limit (whole units / batch, 0 = none)" type="number" value={String(v.batching_limit)} onChange={(x) => setV((s) => ({ ...s, batching_limit: Math.max(0, Math.floor(Number(x) || 0)) }))} />
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
    standard_cost: 0, sale_price: 0, lead_time: 0, batching_limit: 0, qc_specs: "", qc_category_id: "",
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
