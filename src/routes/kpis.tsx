import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { PageHeader, Panel } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { useOrders } from "@/lib/oms-db";
import { useFulfillmentMonitor, useLineProgressAll, backorderOf } from "@/lib/fulfillment-db";
import { useExceptions, useKpiTargets, useSaveKpiTarget } from "@/lib/exceptions-db";
import { useReturns } from "@/lib/returns-db";
import { KpiTrend } from "@/components/kpi-trend";

export const Route = createFileRoute("/kpis")({
  head: () => ({ meta: [
    { title: "KPIs · OMS" },
    { name: "description", content: "On-time shipping, fill rate, cycle time, exception and return rates against your targets." },
    { property: "og:title", content: "KPIs · OMS" },
    { property: "og:description", content: "On-time shipping, fill rate, cycle time, exception and return rates against your targets." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: KpiPage,
});

const DEF: Record<string, { label: string; unit: string; higher: boolean; help: string; link?: "/integrations" }> = {
  order_volume: { label: "Order volume", unit: "", higher: true, help: "Orders received in this period (excluding drafts)" },
  avg_fulfillment_days: { label: "Fulfillment days", unit: "d", higher: false, help: "Average days from fulfillment created to shipped" },
  backorder_rate: { label: "Backorder rate", unit: "%", higher: false, help: "Share of active orders with units still on backorder" },
  integration_success_rate: { label: "Integration message success", unit: "%", higher: true, help: "Messages processed or sent ÷ all finished messages", link: "/integrations" },
  on_time_ship_rate: { label: "On-time shipping", unit: "%", higher: true, help: "Shipped fulfillments sent on or before the promised date" },
  fill_rate: { label: "Fill rate", unit: "%", higher: true, help: "Units shipped ÷ units ordered, for orders that have started shipping" },
  avg_cycle_hours: { label: "Order-to-ship time", unit: "h", higher: false, help: "Average hours from order creation to shipment" },
  exception_rate: { label: "Exception rate", unit: "%", higher: false, help: "Orders with at least one exception ÷ active orders" },
  return_rate: { label: "Return rate", unit: "%", higher: false, help: "Shipped orders with at least one return ÷ shipped orders" },
  open_backorder_units: { label: "Open backorder units", unit: "", higher: false, help: "Units still owed on partly shipped orders" },
};
const PERIODS = [{ d: 30, l: "Last 30 days" }, { d: 90, l: "Last 90 days" }, { d: 365, l: "Last year" }, { d: 0, l: "All time" }];

function KpiPage() {
  const { data: orders = [] } = useOrders();
  const { data: ful = [] } = useFulfillmentMonitor();
  const { data: prog = [] } = useLineProgressAll();
  const { data: exc = [] } = useExceptions();
  const { data: rets = [] } = useReturns();
  const { data: targets = [] } = useKpiTargets();
  const saveT = useSaveKpiTarget();
  const [days, setDays] = useState(90);
  const { data: msgs = [] } = useQuery({ queryKey: ["kpi", "integration_messages"], queryFn: async () => {
    const { data, error } = await supabase.from("integration_messages" as never).select("status, created_at").order("created_at", { ascending: false }).limit(5000);
    if (error) throw error; return (data ?? []) as unknown as { status: string; created_at: string }[];
  } });

  const values = useMemo(() => {
    const since = days ? Date.now() - days * 864e5 : 0;
    const inP = (iso?: string | null) => !!iso && new Date(iso).getTime() >= since;
    const os = orders.filter((o: any) => inP(o.created_at) && o.status !== "draft");
    const ids = new Set(os.map((o: any) => o.id));
    const shipped = ful.filter((f) => f.shipped_at && ids.has(f.order_id));
    const onTime = shipped.filter((f) => !f.promised_date || f.shipped_at!.slice(0, 10) <= f.promised_date).length;
    const startedIds = new Set(os.filter((o: any) => ["partially_shipped", "shipped", "delivered"].includes(o.status)).map((o: any) => o.id));
    const sp = prog.filter((p) => startedIds.has(p.order_id));
    const ord = sp.reduce((s, p) => s + Number(p.ordered), 0), sh = sp.reduce((s, p) => s + Number(p.shipped), 0);
    const created = new Map(os.map((o: any) => [o.id, o.created_at as string]));
    const cyc = shipped.map((f) => (new Date(f.shipped_at!).getTime() - new Date(created.get(f.order_id)!).getTime()) / 36e5);
    const active = os.filter((o: any) => o.status !== "cancelled");
    const withExc = new Set(exc.filter((e) => e.order_id && ids.has(e.order_id)).map((e) => e.order_id));
    const doneIds = new Set(os.filter((o: any) => ["shipped", "delivered", "partially_shipped"].includes(o.status)).map((o: any) => o.id));
    const done = doneIds.size;
    const r = new Set(rets.filter((x) => doneIds.has(x.order_id)).map((x) => x.order_id)).size;
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
    const fd = shipped.map((f: any) => (new Date(f.shipped_at!).getTime() - new Date(f.created_at).getTime()) / 864e5).filter((x) => x >= 0);
    const boOrders = new Set(prog.filter((p) => ids.has(p.order_id) && backorderOf(p) > 0).map((p) => p.order_id));
    const ms = msgs.filter((m) => inP(m.created_at) && ["processed", "sent", "failed", "dead"].includes(m.status));
    return {
      order_volume: os.length,
      avg_fulfillment_days: fd.length ? Math.round((fd.reduce((s, x) => s + x, 0) / fd.length) * 10) / 10 : null,
      backorder_rate: pct([...boOrders].filter((id) => active.some((o: any) => o.id === id)).length, active.length),
      integration_success_rate: pct(ms.filter((m) => ["processed", "sent"].includes(m.status)).length, ms.length),
      on_time_ship_rate: pct(onTime, shipped.length),
      fill_rate: pct(sh, ord),
      avg_cycle_hours: cyc.length ? Math.round(cyc.reduce((s, x) => s + x, 0) / cyc.length) : null,
      exception_rate: pct(withExc.size, active.length),
      return_rate: pct(r, done),
      open_backorder_units: sp.reduce((s, p) => s + backorderOf(p), 0),
    } as Record<string, number | null>;
  }, [orders, ful, prog, exc, rets, msgs, days]);

  const rows = Object.keys(DEF).map((k) => {
    const t = targets.find((x) => x.metric === k); const v = values[k]; const d = DEF[k];
    const met = v == null || !t ? null : d.higher ? v >= Number(t.target) : v <= Number(t.target);
    return { key: k, ...d, value: v, target: t ? Number(t.target) : null, targetId: t?.id, met };
  });

  return (
    <div className="space-y-5">
      <PageHeader title="KPIs" subtitle="Live from orders, fulfillments, exceptions and returns"
        actions={<>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-8 rounded-md border border-border/60 bg-card/60 px-2 text-xs">
            {PERIODS.map((p) => <option key={p.d} value={p.d}>{p.l}</option>)}
          </select>
          <CSVExportButton filename={`kpis-${days || "all"}d`} rows={rows} columns={[
            { key: "label", label: "KPI" }, { key: "value", label: "Value" }, { key: "unit", label: "Unit" }, { key: "target", label: "Target" },
            { key: "met", label: "Target met", get: (r) => r.met == null ? "n/a" : r.met ? "yes" : "no" },
          ]} />
        </>} />
      <KpiTrend orders={orders as any[]} ful={ful as any} exc={exc} msgs={msgs} targets={targets} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <Panel key={r.key}>
            <div className="flex items-start justify-between">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{r.label}</div>
              {r.met != null && <span className={`rounded-full px-2 py-0.5 text-[10px] ${r.met ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{r.met ? "On target" : "Off target"}</span>}
            </div>
            <div className="mt-2 font-mono text-3xl font-semibold">{r.value == null ? "—" : `${r.value}${r.unit}`}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">{r.value == null ? "Not enough data in this period. " : ""}{r.help}</p>
            {r.link && <Link to={r.link} className="mt-1 inline-block text-[11px] text-primary hover:underline">Open Integration Monitor →</Link>}
            {r.targetId && (
              <label className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                Target {r.higher ? "≥" : "≤"}
                <input type="number" min={0} defaultValue={r.target ?? 0} key={r.target}
                  onBlur={(e) => { const n = Number(e.target.value); if (n >= 0 && n !== r.target) saveT.mutate({ id: r.targetId!, target: n }); }}
                  className="h-7 w-20 rounded-md border border-border/60 bg-card/60 px-2 font-mono text-xs text-foreground" />{r.unit}
              </label>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
