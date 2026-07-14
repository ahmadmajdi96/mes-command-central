import type { ReactNode } from "react";

export type AnalyticsCard = {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "info" | "accent" | "destructive";
};

const accents: Record<NonNullable<AnalyticsCard["accent"]>, string> = {
  primary: "from-primary/20 to-primary/0 text-primary",
  success: "from-success/20 to-success/0 text-success",
  warning: "from-warning/20 to-warning/0 text-warning",
  info: "from-info/20 to-info/0 text-info",
  accent: "from-accent/20 to-accent/0 text-accent",
  destructive: "from-destructive/20 to-destructive/0 text-destructive",
};

export function AnalyticsCards({ cards }: { cards: AnalyticsCard[] }) {
  if (!cards.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => {
        const a = accents[c.accent ?? "primary"];
        return (
          <div key={c.label} className="glass-panel relative overflow-hidden rounded-2xl p-4">
            <div className={`absolute inset-0 bg-gradient-to-br ${a} opacity-50 pointer-events-none`} />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{c.label}</div>
              <div className="mt-2 font-mono text-2xl font-semibold tracking-tight">{c.value}</div>
              {c.hint && <div className="mt-1 text-[11px] text-muted-foreground">{c.hint}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
