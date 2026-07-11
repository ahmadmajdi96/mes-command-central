import { useState, useEffect, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "date" | "textarea" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  step?: number;
};

export function FormDialog<T extends Record<string, any>>({
  open, onOpenChange, title, description, fields, initial, submitLabel = "Save",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  fields: FormField[];
  initial?: Partial<T>;
  submitLabel?: string;
  onSubmit: (values: T) => Promise<void> | void;
}) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const seed: Record<string, any> = {};
      for (const f of fields) seed[f.name] = initial?.[f.name] ?? (f.type === "number" ? 0 : "");
      setValues(seed);
    }
  }, [open]); // eslint-disable-line

  const submit = async () => {
    for (const f of fields) {
      if (f.required && (values[f.name] === "" || values[f.name] == null)) {
        toast.error(`${f.label} is required`);
        return;
      }
    }
    try {
      setBusy(true);
      await onSubmit(values as T);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{f.label}{f.required && " *"}</label>
              {f.type === "textarea" ? (
                <textarea rows={3} placeholder={f.placeholder}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-card/60 p-2 text-sm focus:border-primary/50 focus:outline-none" />
              ) : f.type === "select" ? (
                <select
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm focus:border-primary/50 focus:outline-none">
                  <option value="">— select —</option>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  type={f.type ?? "text"} step={f.step} placeholder={f.placeholder}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-3 text-sm focus:border-primary/50 focus:outline-none"
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground">Cancel</button>
          <button disabled={busy} onClick={submit} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
            {busy ? "Saving…" : submitLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
