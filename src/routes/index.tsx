import { useState } from "react";
import { NewOrderDialog } from "@/components/new-order-dialog";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CheckCircle2, Factory, Package, ShoppingCart, TrendingUp, AlertTriangle, UserCircle, Boxes, LayoutDashboard, Plus } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { DashboardCharts } from "@/components/dashboard-charts";
import { useOrders, useCustomers, useProducts, useShipments } from "@/lib/oms-db";
import { useProductionOrders } from "@/lib/production-orders-db";
import { useBatches } from "@/lib/batches-db";
import { usePriorityQueue } from "@/lib/exceptions-db";
import { DispatcherBanner } from "@/components/dispatcher";
import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · CORTA OMS" },
      { name: "description", content: "Real-time order, production and shipment KPIs across the plant." },
      { property: "og:title", content: "Dashboard · CORTA OMS" },
      { property: "og:description", content: "Real-time order, production and shipment KPIs across the plant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Kpi({
  label, value, icon: Icon, accent = "primary", suffix, href, hint,
}: {
  label: string; value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "success" | "warning" | "info" | "accent";
  suffix?: string; href?: string; hint?: string;
}) {
  const map = {
    primary: "from-primary/20 to-primary/0 text-primary",
    success: "from-success/20 to-success/0 text-success",
    warning: "from-warning/20 to-warning/0 text-warning",
    info: "from-info/20 to-info/0 text-info",
    accent: "from-accent/20 to-accent/0 text-accent",
  } as const;
  const inner = (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-4 h-full">
      <div className={`absolute inset-0 bg-gradient-to-br ${map[accent]} opacity-60`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${map[accent].split(" ").pop()}`} />
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-mono text-3xl font-semibold tracking-tight">{value}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
  return href ? <Link to={href} className="block">{inner}</Link> : inner;
}

function Dashboard() {
  const [openNew, setOpenNew] = useState(false);
  const { data: orders = [] } = useOrders();
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: shipments = [] } = useShipments();
  const { data: pos = [] } = useProductionOrders();
  const { data: batches = [] } = useBatches();
  const { data: queue = [] } = usePriorityQueue();

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const openOrders = orders.filter((o) => !["shipped", "cancelled"].includes(o.status)).length;
    const inProduction = pos.filter((p) => p.status === "in_progress" || p.status === "released").length;
    const overdue = orders.filter((o) => o.due_date && o.due_date < today && o.status !== "shipped" && o.status !== "cancelled").length;
    const shippedWeek = shipments.filter((s) => s.status === "shipped" || s.status === "delivered")
      .filter((s) => (s.shipped_at ?? s.updated_at ?? "").slice(0, 10) >= weekAgo).length;
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);
    const shippedOrders = orders.filter((o) => o.status === "shipped").length;
    const otdRate = orders.length ? Math.round((shippedOrders / orders.length) * 100) : 0;
    return { openOrders, inProduction, overdue, shippedWeek, totalRevenue, otdRate };
  }, [orders, shipments, pos]);

  const findCustomer = (id: string | null) => customers.find((c) => c.id === id);
  const recent = [...orders].sort((a, b) => (b.order_date ?? "").localeCompare(a.order_date ?? "")).slice(0, 6);

  return (
    <div className="mx-auto max-w-[96rem] space-y-4">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Live view of orders, production and shipments"
        icon={<LayoutDashboard />}
        className="mb-6"
        actions={(
          <Button type="button" className="min-h-11" onClick={() => setOpenNew(true)}>
            <Plus aria-hidden /> New Sales Order
          </Button>
        )}
      />
      <DispatcherBanner />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Open Orders" value={stats.openOrders} icon={ShoppingCart} accent="primary" href="/orders" />
        <Kpi label="In Production" value={stats.inProduction} icon={Factory} accent="info" href="/production-orders" />
        <Kpi label="Overdue" value={stats.overdue} icon={AlertTriangle} accent="warning" href="/orchestration" />
        <Kpi label="Shipped / wk" value={stats.shippedWeek} icon={Package} accent="success" href="/shipments" />
        <Kpi label="Shipped Rate" value={stats.otdRate} suffix="%" icon={CheckCircle2} accent="success" />
        <Kpi label="Revenue" value={`$${(stats.totalRevenue / 1000).toFixed(1)}k`} icon={TrendingUp} accent="accent" hint="All orders" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Problems needing attention" value={queue.length} icon={AlertTriangle} accent="warning" href="/exceptions" hint={`${queue.filter((q: any) => ["high", "critical"].includes(q.severity)).length} high or critical`} />
        <Kpi label="Customers" value={customers.length} icon={UserCircle} accent="info" href="/customers" />
        <Kpi label="Products" value={products.length} icon={Package} accent="primary" href="/products" />
        <Kpi label="Production Orders" value={pos.length} icon={Factory} accent="info" href="/production-orders" />
        <Kpi label="Batches" value={batches.length} icon={Boxes} accent="accent" href="/batches" />
      </div>
      <DashboardCharts />
      <NewOrderDialog open={openNew} onOpenChange={setOpenNew} />


      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Recent Sales Orders</h3>
            <p className="text-xs text-muted-foreground">Latest 6</p>
          </div>
          <Link to="/orders" className="text-xs text-primary hover:underline">All orders →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Order</th>
                <th className="py-2 pr-4 font-medium">Customer</th>
                <th className="py-2 pr-4 font-medium">Due</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No sales orders yet</td></tr>
              )}
              {recent.map((o) => (
                <tr key={o.id} className="border-t border-border/40 hover:bg-card/40">
                  <td className="py-3 pr-4">
                    <Link to="/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-xs text-primary hover:underline">{o.number}</Link>
                  </td>
                  <td className="py-3 pr-4 text-xs">{findCustomer(o.customer_id)?.name ?? "—"}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{o.due_date ?? "—"}</td>
                  <td className="py-3 pr-4"><StatusPill status={o.status} /></td>
                  <td className="py-3 pr-4 text-right font-mono text-xs">${Number(o.total ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
