import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useOrders, useProducts } from "@/lib/oms-db";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children as never}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardCharts() {
  const { data: orders = [] } = useOrders();
  const { data: products = [] } = useProducts();

  // Line: orders over last 30 days
  const line = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
      buckets.set(d, 0);
    }
    orders.forEach((o) => {
      const d = (o.order_date ?? o.created_at ?? "").slice(0, 10);
      if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
    });
    return Array.from(buckets.entries()).map(([date, count]) => ({ date: date.slice(5), count }));
  }, [orders]);

  // Bar: revenue by status
  const bar = useMemo(() => {
    const m = new Map<string, number>();
    orders.forEach((o) => {
      m.set(o.status, (m.get(o.status) ?? 0) + Number(o.total ?? 0));
    });
    return Array.from(m.entries()).map(([status, revenue]) => ({ status, revenue: Math.round(revenue) }));
  }, [orders]);

  // Bar: top products by qty from order lines
  const { data: topProducts = [] } = useQuery({
    queryKey: ["dashboard-top-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_order_lines")
        .select("product_id, qty");
      const totals = new Map<string, number>();
      for (const l of (data ?? []) as Array<{ product_id: string | null; qty: number }>) {
        if (!l.product_id) continue;
        totals.set(l.product_id, (totals.get(l.product_id) ?? 0) + Number(l.qty ?? 0));
      }
      return Array.from(totals.entries())
        .map(([product_id, qty]) => ({ product_id, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);
    },
  });
  const topBar = useMemo(
    () => topProducts.map((t) => {
      const p = products.find((x) => x.id === t.product_id);
      return { name: p?.sku ?? t.product_id.slice(0, 6), qty: t.qty };
    }),
    [topProducts, products],
  );

  const axis = { stroke: "var(--muted-foreground)", fontSize: 11 };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Orders over time" subtitle="Last 30 days">
        <LineChart data={line} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.4} />
          <XAxis dataKey="date" {...axis} />
          <YAxis allowDecimals={false} {...axis} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--card-foreground)", fontSize: 12 }} />
          <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={false} />
        </LineChart>
      </Panel>
      <Panel title="Revenue by status" subtitle="All orders">
        <BarChart data={bar} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.4} />
          <XAxis dataKey="status" {...axis} />
          <YAxis {...axis} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--card-foreground)", fontSize: 12 }} />
          <Bar dataKey="revenue" fill="var(--info)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </Panel>
      <Panel title="Top products" subtitle="By quantity ordered">
        <BarChart data={topBar} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.4} />
          <XAxis dataKey="name" {...axis} />
          <YAxis {...axis} />
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--card-foreground)", fontSize: 12 }} />
          <Bar dataKey="qty" fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </Panel>

    </div>
  );
}
