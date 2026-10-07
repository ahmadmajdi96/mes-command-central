import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Panel } from "@/components/page-shell";

type Ful = { order_id: string; shipped_at?: string | null; promised_date?: string | null };
const METRICS: Record<string, { label: string; unit: string; target?: string }> = {
  order_volume: { label: "Order volume", unit: "", target: "order_volume" },
  on_time_ship_rate: { label: "On-time shipping", unit: "%", target: "on_time_ship_rate" },
  avg_fulfillment_days: { label: "Fulfillment days", unit: "d", target: "avg_fulfillment_days" },
  exception_rate: { label: "Exception rate", unit: "%", target: "exception_rate" },
  integration_success_rate: { label: "Integration message success", unit: "%", target: "integration_success_rate" },
};

const wk = (iso: string) => { const d = new Date(iso); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))); return x.toISOString().slice(0, 10); };

/** Week-by-week trend for one KPI over the last 12 weeks, with its target line. */
export function KpiTrend({ orders, ful, exc, msgs, targets }: { orders: any[]; ful: Ful[]; exc: Array<{ order_id: string | null; created_at: string }>; msgs: Array<{ status: string; created_at: string }>; targets: Array<{ metric: string; target: number }> }) {
  const [m, setM] = useState("order_volume");
  const data = useMemo(() => {
    const weeks: string[] = []; const now = wk(new Date().toISOString());
    for (let i = 11; i >= 0; i--) { const d = new Date(now); d.setUTCDate(d.getUTCDate() - i * 7); weeks.push(d.toISOString().slice(0, 10)); }
    const created = new Map(orders.map((o) => [o.id, o.created_at as string]));
    return weeks.map((w) => {
      const os = orders.filter((o) => o.status !== "draft" && o.created_at && wk(o.created_at) === w);
      const sh = ful.filter((f) => f.shipped_at && wk(f.shipped_at) === w);
      const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
      let v: number | null = null;
      if (m === "order_volume") v = os.length;
      if (m === "on_time_ship_rate") v = pct(sh.filter((f) => !f.promised_date || f.shipped_at!.slice(0, 10) <= f.promised_date).length, sh.length);
      if (m === "avg_fulfillment_days") { const d = sh.filter((f) => created.get(f.order_id)).map((f) => (new Date(f.shipped_at!).getTime() - new Date(created.get(f.order_id)!).getTime()) / 864e5); v = d.length ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : null; }
      if (m === "exception_rate") { const ids = new Set(os.map((o) => o.id)); v = pct(new Set(exc.filter((e) => e.order_id && ids.has(e.order_id)).map((e) => e.order_id)).size, os.length); }
      if (m === "integration_success_rate") { const ms = msgs.filter((x) => wk(x.created_at) === w); v = pct(ms.filter((x) => ["processed", "sent"].includes(x.status)).length, ms.length); }
      return { week: w.slice(5), value: v };
    });
  }, [m, orders, ful, exc, msgs]);
  const t = targets.find((x) => x.metric === METRICS[m].target);
  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Trend — last 12 weeks</h3>
        <select value={m} onChange={(e) => setM(e.target.value)} className="h-8 rounded-md border border-border/60 bg-card/60 px-2 text-xs">
          {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={11} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 12 }} formatter={(v: any) => (v == null ? "no data" : `${v}${METRICS[m].unit}`)} />
            {t && Number(t.target) > 0 && <ReferenceLine y={Number(t.target)} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: "target", fill: "var(--warning)", fontSize: 10 }} />}
            <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} connectNulls dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
