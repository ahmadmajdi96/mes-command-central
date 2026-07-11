import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageHeader({
  title, subtitle, actions, breadcrumb,
}: {
  title: string; subtitle?: string; actions?: ReactNode; breadcrumb?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {breadcrumb && <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{breadcrumb}</div>}
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass-panel rounded-2xl p-5", className)}>{children}</div>;
}

export function DataTable<T>({
  columns, rows, empty = "No records",
}: {
  columns: { key: string; label: string; align?: "left" | "right"; render: (row: T) => ReactNode }[];
  rows: T[];
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-12 text-center">
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  }
  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-3 font-medium", c.align === "right" && "text-right")}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/40 last:border-0 hover:bg-card/60">
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3", c.align === "right" && "text-right")}>{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm", mono && "font-mono")}>{value}</div>
    </div>
  );
}
