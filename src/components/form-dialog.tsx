import { useState, useEffect, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ThemedSelect, NumberField, inputCls } from "@/components/ui/form-controls";

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "date" | "textarea" | "select" | "tel";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  step?: number;
  /** Minimum for number fields. Defaults to 0 (no negatives) unless allowNegative is set. */
  min?: number;
  max?: number;
  allowNegative?: boolean;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\+?[0-9\s().-]{6,20}$/;

/** Returns an error message for one field value, or null when valid. */
export function validateField(f: FormField, raw: unknown): string | null {
  const empty = raw === "" || raw == null;
  if (f.required && empty) return `${f.label} is required`;
  if (empty) return null;
  if (f.type === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return `${f.label} must be a number`;
    const min = f.allowNegative ? f.min : (f.min ?? 0);
    if (min != null && n < min) return `${f.label} must be ${min === 0 ? "zero or more" : `at least ${min}`}`;
    if (f.max != null && n > f.max) return `${f.label} must be at most ${f.max}`;
  }
  if (f.type === "email" && !EMAIL_RE.test(String(raw).trim())) return `${f.label} must be a valid email, e.g. name@company.com`;
  if (f.type === "tel" && !PHONE_RE.test(String(raw).trim())) return `${f.label} must be a valid phone number, e.g. +1 555 000 0000`;
  return null;
}

export function FormDialog<T extends Record<string, any>>({
  open, onOpenChange, title, description, fields, initial, submitLabel = "Save",
  onSubmit, children, wide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: ReactNode;
  fields: FormField[];
  initial?: Partial<T>;
  submitLabel?: string;
  onSubmit: (values: T) => Promise<void> | void;
  children?: ReactNode;
  wide?: boolean;
}) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      const seed: Record<string, any> = {};
      for (const f of fields) seed[f.name] = initial?.[f.name] ?? (f.type === "number" ? 0 : "");
      setValues(seed);
      setErrors({});
    }
  }, [open]); // eslint-disable-line

  const set = (f: FormField, v: any) => {
    setValues((s) => ({ ...s, [f.name]: v }));
    if (errors[f.name]) setErrors((e) => { const n = { ...e }; delete n[f.name]; return n; });
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    for (const f of fields) { const m = validateField(f, values[f.name]); if (m) errs[f.name] = m; }
    setErrors(errs);
    const first = Object.values(errs)[0];
    if (first) { toast.error(first); return; }
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
      <DialogContent className={wide ? "max-w-2xl" : "max-w-lg"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {fields.map((f) => {
            const err = errors[f.name];
            const cls = inputCls + (err ? " border-destructive/70" : "");
            return (
              <div key={f.name}>
                <label htmlFor={`fd-${f.name}`} className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{f.label}{f.required && " *"}</label>
                <div className="mt-1">
                  {f.type === "textarea" ? (
                    <textarea id={`fd-${f.name}`} rows={3} placeholder={f.placeholder}
                      value={values[f.name] ?? ""} onChange={(e) => set(f, e.target.value)}
                      className={cls.replace("h-9", "") + " py-2"} />
                  ) : f.type === "select" ? (
                    <ThemedSelect id={`fd-${f.name}`} value={values[f.name] ?? ""} onChange={(v) => set(f, v)}
                      options={f.options ?? []} invalid={!!err} />
                  ) : f.type === "number" ? (
                    <NumberField id={`fd-${f.name}`} value={values[f.name]} step={f.step}
                      min={f.allowNegative ? f.min : (f.min ?? 0)} max={f.max} placeholder={f.placeholder}
                      invalid={!!err} onChange={(v) => set(f, v)} />
                  ) : (
                    <input id={`fd-${f.name}`}
                      type={f.type ?? "text"} placeholder={f.placeholder}
                      inputMode={f.type === "tel" ? "tel" : f.type === "email" ? "email" : undefined}
                      autoComplete={f.type === "email" ? "email" : f.type === "tel" ? "tel" : undefined}
                      value={values[f.name] ?? ""} onChange={(e) => set(f, e.target.value)}
                      className={cls} />
                  )}
                </div>
                {err ? <p className="mt-1 text-[11px] text-destructive">{err}</p>
                  : f.hint ? <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p> : null}
              </div>
            );
          })}
          {children}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
        <DialogFooter>
          <button type="button" onClick={() => onOpenChange(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground">Cancel</button>
          <button type="button" disabled={busy} onClick={submit} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
            {busy ? "Saving…" : submitLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
