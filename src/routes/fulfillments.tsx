import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { AnalyticsCards } from "@/components/analytics-cards";
import { CSVExportButton } from "@/components/csv-export-button";
import { StatusPill } from "@/components/status-pill";
import { FulfillmentActions } from "@/components/fulfillment-actions";
import { useCustomers, useProducts, useRealtimeInvalidate } from "@/lib/oms-db";
import { backorderOf, fulKey, useFulfillmentMonitor, useLineProgressAll, type Fulfillment } from "@/lib/fulfillment-db";

export const Route = createFileRoute("/fulfillments")({
  head: () => ({ meta: [
    { title: "Fulfillment Monitor · OMS" },
    { name: "description", content: "Track fulfillments by location, ship partial and split orders, and watch backorders." },
    { property: "og:title", content: "Fulfillment Monitor · OMS" },
    { property: "og:description", content: "Track fulfillments by location, ship partial and split orders, and watch backorders." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FulfillmentsPage,
});

const QUEUES = ["Open", "Delayed", "Failed", "Shipped", "Delivered", "All", "Backorders"] as const;
type Q = typeof QUEUES[number];
const OPEN = ["pending", "picking", "packed"];
const DELAY_HOURS = 48;

function FulfillmentsPage() {
  useRealtimeInvalidate("fulfillments" as never, [fulKey]);
  const { data: rows = [], isLoading } = useFulfillmentMonitor();
  const { data: progress = [] } = useLineProgressAll();
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const [q, setQ] = useState<Q>("Open");

  const today = new Date().toISOString().slice(0, 10);
  const delayed = (r: Fulfillment) => OPEN.includes(r.status) && (Number(r.hours_in_status) > DELAY_HOURS || (!!r.promised_date && r.promised_date < today));
  const test: Record<Exclude<Q, "Backorders">, (r: Fulfillment) => boolean> = {
    Open: (r) => OPEN.includes(r.status), Delayed: delayed, Failed: (r) => r.status === "failed",
    Shipped: (r) => r.status === "shipped", Delivered: (r) => r.status === "delivered", All: () => true,
  };
  const backorders = progress.map((p) => ({ ...p, backorder: backorderOf(p) })).filter((p) => p.backorder > 0 && Number(p.shipped) > 0 || (p.backorder > 0 && Number(p.in_fulfillment) > 0));
  const filtered = q === "Backorders" ? [] : rows.filter(test[q]);
  const cards = useMemo(() => [
    { label: "Open", value: rows.filter(test.Open).length, accent: "primary" as const },
    { label: "Delayed", value: rows.filter(delayed).length, accent: "destructive" as const, hint: `> ${DELAY_HOURS}h or past promise` },
    { label: "Failed", value: rows.filter(test.Failed).length, accent: "destructive" as const },
    { label: "Shipped", value: rows.filter(test.Shipped).length, accent: "info" as const },
    { label: "Delivered", value: rows.filter(test.Delivered).length, accent: "success" as const },
    { label: "Backordered units", value: backorders.reduce((s, b) => s + b.backorder, 0), accent: "warning" as const },
  ], [rows, progress]);
  const cust = (id?: string | null) => customers.find((c) => c.id === id)?.name ?? "—";
  const prod = (id: string | null) => { const p = products.find((x: any) => x.id === id) as any; return p ? `${p.sku} ${p.name}` : "—"; };

  return (
    <div className="space-y-5">
      <PageHeader title="Fulfillment Monitor" subtitle={isLoading ? "Loading…" : `${rows.length} fulfillments`}
        actions={<CSVExportButton filename={`fulfillments-${q}`} rows={filtered} columns={[
          { key: "number", label: "Fulfillment" }, { key: "order_number", label: "Order" }, { key: "status", label: "Status" },
          { key: "location_code", label: "Location" }, { key: "total_qty", label: "Units" }, { key: "carrier", label: "Carrier" }, { key: "tracking", label: "Tracking" },
          { key: "hours_in_status", label: "Hours in status", get: (r) => Math.round(Number(r.hours_in_status)) },
        ]} />} />
      <AnalyticsCards cards={cards} />
      <div className="glass-panel flex flex-wrap gap-1 rounded-2xl p-3">
        {QUEUES.map((x) => <button key={x} onClick={() => setQ(x)} className={`rounded-lg px-2.5 py-1 text-[11px] ${q === x ? "border border-primary/30 bg-primary/15 text-primary" : "border border-transparent text-muted-foreground"}`}>{x}</button>)}
      </div>
      {q === "Backorders" ? (
        <DataTable rows={backorders} empty="No backorders — every partly fulfilled line is complete" columns={[
          { key: "o", label: "Order", render: (r) => <Link to="/orders/$orderId" params={{ orderId: r.order_id }} className="font-mono text-xs text-primary hover:underline">Open order</Link> },
          { key: "p", label: "Product", render: (r) => <span className="text-xs">{prod(r.product_id)}</span> },
          { key: "ord", label: "Ordered", align: "right", render: (r) => <span className="font-mono text-xs">{Number(r.ordered)}</span> },
          { key: "sh", label: "Shipped", align: "right", render: (r) => <span className="font-mono text-xs">{Number(r.shipped)}</span> },
          { key: "f", label: "In fulfillment", align: "right", render: (r) => <span className="font-mono text-xs">{Number(r.in_fulfillment)}</span> },
          { key: "bo", label: "Backorder", align: "right", sortAccessor: (r) => r.backorder, render: (r) => <span className="font-mono text-xs text-warning">{r.backorder}</span> },
        ]} />
      ) : (
        <DataTable<Fulfillment> rows={filtered} defaultSort={{ key: "age", dir: "desc" }} empty="Nothing in this queue" columns={[
          { key: "number", label: "Fulfillment", sortAccessor: (r) => r.number, render: (r) => <span className="font-mono text-xs">{r.number}</span> },
          { key: "order", label: "Order", render: (r) => <Link to="/orders/$orderId" params={{ orderId: r.order_id }} className="font-mono text-xs text-primary hover:underline">{r.order_number}</Link> },
          { key: "c", label: "Customer", render: (r) => <span className="text-xs">{cust(r.customer_id)}</span> },
          { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
          { key: "loc", label: "From", render: (r) => <span className="text-xs">{r.location_code ?? "—"}</span> },
          { key: "qty", label: "Units", align: "right", render: (r) => <span className="font-mono text-xs">{Number(r.total_qty)} · {r.line_count} line(s)</span> },
          { key: "trk", label: "Tracking", render: (r) => <span className="text-xs">{[r.carrier, r.tracking].filter(Boolean).join(" · ") || "—"}{r.status === "failed" && r.failure_reason ? <span className="text-destructive"> · {r.failure_reason}</span> : null}</span> },
          { key: "age", label: "In status", sortAccessor: (r) => Number(r.hours_in_status), render: (r) => <span className={`font-mono text-xs ${delayed(r) ? "text-destructive" : ""}`}>{Math.round(Number(r.hours_in_status))}h</span> },
          { key: "a", label: "", align: "right", render: (r) => <FulfillmentActions f={r} /> },
        ]} />
      )}
    </div>
  );
}
