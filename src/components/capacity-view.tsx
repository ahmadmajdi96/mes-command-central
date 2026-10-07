import { useMemo, useState } from "react";
import { Panel } from "@/components/page-shell";

const DEFAULT_WEEKLY_UNITS = 1000;

function weekStart(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day);
  return x.toISOString().slice(0, 10);
}

/** Weekly load of open production orders (by planned start, or today if unplanned) against an editable weekly capacity. */
export function CapacityView({ orders }: { orders: Array<{ qty: number | string; qty_produced?: number | string; status: string; planned_start?: string | null }> }) {
  const [cap, setCap] = useState<number>(() => (typeof window === "undefined" ? DEFAULT_WEEKLY_UNITS : Number(localStorage.getItem("oms.weeklyCapacity")) || DEFAULT_WEEKLY_UNITS));
  const weeks = useMemo(() => {
    const today = weekStart(new Date());
    const out = new Map<string, { units: number; count: number }>();
    for (let i = 0; i < 8; i++) { const d = new Date(today); d.setUTCDate(d.getUTCDate() + i * 7); out.set(d.toISOString().slice(0, 10), { units: 0, count: 0 }); }
    for (const o of orders) {
      if (["completed", "cancelled"].includes(o.status)) continue;
      let w = o.planned_start ? weekStart(new Date(o.planned_start)) : today;
      if (w < today) w = today; // overdue work lands in the current week
      const cur = out.get(w); if (!cur) continue;
      cur.units += Math.max(Number(o.qty) - Number(o.qty_produced ?? 0), 0); cur.count++;
    }
    return [...out.entries()];
  }, [orders]);
  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Capacity by week</h3>
          <p className="text-[11px] text-muted-foreground">Remaining units of open production orders by planned start. Late work counts in this week.</p>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">Weekly capacity
          <input type="number" min={1} value={cap} onChange={(e) => { const n = Math.max(1, Number(e.target.value) || 1); setCap(n); localStorage.setItem("oms.weeklyCapacity", String(n)); }}
            className="h-7 w-24 rounded-md border border-border/60 bg-card/60 px-2 font-mono text-xs text-foreground" /> units
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {weeks.map(([w, v]) => {
          const pct = Math.round((v.units / cap) * 100);
          const tone = pct > 100 ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-success";
          return (
            <div key={w} className="rounded-lg border border-border/60 bg-card/40 p-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Week of {w.slice(5)}</div>
              <div className="mt-1 font-mono text-sm">{v.units.toLocaleString()}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted"><div className={`h-full ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
              <div className={`mt-1 text-[10px] ${pct > 100 ? "text-destructive" : "text-muted-foreground"}`}>{pct}% · {v.count} order(s)</div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
