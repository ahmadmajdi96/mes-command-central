import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line as RLine,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PolarAngleAxis, RadialBar, RadialBarChart,
} from "recharts";
import {
  ArrowUpRight, CheckCircle2, ClipboardList, Factory, Package, ShoppingCart, Timer, TrendingUp, AlertTriangle,
} from "lucide-react";
import {
  dashboardKpis, orderTrend, productionMix, salesOrders,
  findCustomer,
} from "@/lib/oms-data";
import { useStore } from "@/lib/store";
import { StatusPill } from "@/components/status-pill";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard · CORTA OMS" },
      { name: "description", content: "Real-time order, production and shipment KPIs across the plant." },
    ],
  }),
  component: Dashboard,
});

const tooltipStyle = {
  background: "oklch(0.16 0.02 240 / 0.95)",
  border: "1px solid oklch(0.3 0.02 245)",
  borderRadius: 8,
  fontSize: 12,
};

function Kpi({
  label, value, delta, icon: Icon, accent = "primary", suffix, href,
}: {
  label: string; value: string | number; delta?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "success" | "warning" | "info" | "accent";
  suffix?: string; href?: string;
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
        {delta && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ArrowUpRight className="h-3 w-3 text-success" />
            <span>{delta}</span>
          </div>
        )}
      </div>
    </div>
  );
  return href ? <Link to={href} className="block">{inner}</Link> : inner;
}

function Dashboard() {
  const workOrders = useStore((s) => s.workOrders);
  const auditLog = useStore((s) => s.audit);
  const runningWO = workOrders.filter((w) => w.status === "in_progress");
  const wsActive = workstations.filter((w) => w.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Order Ops Dashboard</h1>
          <p className="text-sm text-muted-foreground">Plant 01 — Riyadh · Shift A · Live</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/orders" className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card">View orders</Link>
          <Link to="/orders" className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">+ New Sales Order</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Open Orders" value={dashboardKpis.openOrders} icon={ShoppingCart} accent="primary" href="/orders" />
        <Kpi label="In Production" value={dashboardKpis.inProduction} icon={Factory} accent="info" href="/production-orders" />
        <Kpi label="Overdue" value={dashboardKpis.overdue} icon={AlertTriangle} accent="warning" />
        <Kpi label="Shipped / wk" value={dashboardKpis.shippedThisWeek} icon={Package} accent="success" href="/shipments" />
        <Kpi label="OTD Rate" value={dashboardKpis.otdRate} suffix="%" icon={CheckCircle2} accent="success" delta="+1.4 vs LW" />
        <Kpi label="Revenue" value={`$${(dashboardKpis.revenue / 1000).toFixed(0)}k`} icon={TrendingUp} accent="accent" delta="MTD" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Order Intake vs Shipments</h3>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
            <div className="flex gap-3 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Orders</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Shipped</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={orderTrend}>
                <defs>
                  <linearGradient id="og1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 195)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="og2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 155)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 155)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 245 / 0.4)" />
                <XAxis dataKey="d" stroke="oklch(0.68 0.02 245)" fontSize={11} />
                <YAxis stroke="oklch(0.68 0.02 245)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="orders" stroke="oklch(0.78 0.16 195)" fill="url(#og1)" strokeWidth={2} />
                <Area type="monotone" dataKey="shipped" stroke="oklch(0.72 0.18 155)" fill="url(#og2)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">On-Time Delivery</h3>
          <p className="text-xs text-muted-foreground">Rolling 30-day</p>
          <div className="relative mt-2 h-56">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="60%" outerRadius="95%" data={[{ name: "otd", value: dashboardKpis.otdRate, fill: "oklch(0.72 0.18 155)" }]} startAngle={210} endAngle={-30}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" background={{ fill: "oklch(0.25 0.02 245)" }} cornerRadius={12} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-4xl font-semibold text-glow">{dashboardKpis.otdRate}</span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">OTD %</span>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
            <div><div className="font-mono text-sm text-success">96%</div><div className="text-muted-foreground">On-time</div></div>
            <div><div className="font-mono text-sm text-warning">3%</div><div className="text-muted-foreground">Late</div></div>
            <div><div className="font-mono text-sm text-destructive">1%</div><div className="text-muted-foreground">Missed</div></div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-panel rounded-2xl p-5 lg:col-span-2">
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
                {salesOrders.slice(0, 6).map((o) => (
                  <tr key={o.id} className="border-t border-border/40 hover:bg-card/40">
                    <td className="py-3 pr-4">
                      <Link to="/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-xs text-primary hover:underline">{o.number}</Link>
                    </td>
                    <td className="py-3 pr-4 text-xs">{findCustomer(o.customerId)?.name}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{o.dueDate}</td>
                    <td className="py-3 pr-4"><StatusPill status={o.status} /></td>
                    <td className="py-3 pr-4 text-right font-mono text-xs">${o.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5">
          <h3 className="text-sm font-semibold">Production Mix</h3>
          <p className="text-xs text-muted-foreground">Active WO count by operation</p>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={productionMix} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {productionMix.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-[11px]">
            {productionMix.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </span>
                <span className="font-mono">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Activity Feed</h3>
          <Link to="/audit" className="text-xs text-primary hover:underline">Audit →</Link>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {auditLog.slice(0, 6).map((a) => (
            <div key={a.id} className="rounded-lg border border-border/60 bg-card/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium truncate">{a.action}</span>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">{a.at.slice(-5)}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{a.detail}</p>
              <p className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{a.user}</span>
                <span className="font-mono">{a.entity}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
