import { Minus, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const inputCls =
  "h-9 w-full rounded-lg border border-border/60 bg-card/60 px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none";

const EMPTY = "__empty__";

/** Themed dropdown that replaces the browser's native list. "" means no selection. */
export function ThemedSelect({
  id, value, onChange, options, placeholder = "— select —", invalid, className, allowEmpty = true,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  allowEmpty?: boolean;
}) {
  return (
    <Select value={value === "" ? EMPTY : value} onValueChange={(v) => onChange(v === EMPTY ? "" : v)}>
      <SelectTrigger id={id}
        className={cn("h-9 w-full rounded-lg border-border/60 bg-card/60 text-sm", invalid && "border-destructive/70", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {allowEmpty && <SelectItem value={EMPTY} className="text-muted-foreground">{placeholder}</SelectItem>}
        {options.filter((o) => o.value !== "").map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Number input with themed +/- buttons; blocks values below `min` (default no negatives). */
export function NumberField({
  id, value, onChange, min = 0, max, step = 1, placeholder, invalid, className,
}: {
  id?: string;
  value: number | string | null | undefined;
  onChange: (v: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
}) {
  const clamp = (n: number) => {
    if (min != null && n < min) n = min;
    if (max != null && n > max) n = max;
    return Math.round(n * 1e6) / 1e6;
  };
  const cur = value === "" || value == null ? null : Number(value);
  const bump = (d: number) => onChange(clamp((cur ?? 0) + d * step));
  return (
    <div className={cn("flex h-9 w-full items-stretch overflow-hidden rounded-lg border border-border/60 bg-card/60 focus-within:border-primary/50", invalid && "border-destructive/70", className)}>
      <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} placeholder={placeholder}
        value={value ?? ""}
        onKeyDown={(e) => { if ((min ?? -1) >= 0 && (e.key === "-" || e.key === "e" || e.key === "E")) e.preventDefault(); }}
        onChange={(e) => {
          const t = e.target.value;
          if (t === "") return onChange("");
          const n = Number(t);
          if (!Number.isFinite(n)) return;
          onChange(min != null && n < min ? min : n);
        }}
        className="no-spinner min-w-0 flex-1 bg-transparent px-3 text-sm focus:outline-none" />
      <div className="flex border-l border-border/60">
        <button type="button" aria-label="Decrease" onClick={() => bump(-1)} className="px-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground"><Minus className="h-3 w-3" /></button>
        <button type="button" aria-label="Increase" onClick={() => bump(1)} className="border-l border-border/60 px-2 text-muted-foreground hover:bg-muted/40 hover:text-foreground"><Plus className="h-3 w-3" /></button>
      </div>
    </div>
  );
}
