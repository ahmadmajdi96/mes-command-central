import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { FormDialog } from "@/components/form-dialog";
import { AnalyticsCards } from "@/components/analytics-cards";
import { useReturns, useCreateReturn, type ReturnRow } from "@/lib/returns-db";
import { useOrders, useRealtimeInvalidate } from "@/lib/oms-db";

export const Route = createFileRoute("/returns/")({
  head: () => ({ meta: [{ title: "Returns · OMS" }] }),
  component: ReturnsList,
});

function ReturnsList() {
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  useRealtimeInvalidate("returns" as never, [["returns"]]);
  const { data: returns = [], isLoading } = useReturns();
  const { data: orders = [] } = useOrders();
  const create = useCreateReturn();

  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const filtered = useMemo(
    () => returns.filter((r) => {
      if (!q) return true;
      const s = q.toLowerCase();
      const o = orderById.get(r.order_id);
      return r.number.toLowerCase().includes(s) || (o?.number ?? "").toLowerCase().includes(s) || (r.reason ?? "").toLowerCase().includes(s);
    }),
    [returns, q, orderById],
  );

  const analytics = useMemo(() => {
    const by = (s: string) => returns.filter((r) => r.status === s).length;
    return [
      { label: "Total", value: returns.length, accent: "primary" as const },
      { label: "Requested", value: by("requested"), accent: "warning" as const },
      { label: "Approved", value: by("approved"), accent: "info" as const },
      { label: "Refunded", value: by("refunded"), accent: "success" as const },
      { label: "Rejected", value: by("rejected"), accent: "destructive" as const },
      { label: "Closed", value: by("closed"), accent: "accent" as const },
    ];
  }, [returns]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Returns & Refunds"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${returns.length}`}
        actions={
          <button
            onClick={() => setOpenNew(true)}
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
          >
            <Plus className="h-3.5 w-3.5" /> New Return
          </button>
        }
      />
      <AnalyticsCards cards={analytics} />

      <div className="glass-panel flex items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search RET number, order, reason…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none"
          />
        </div>
      </div>

      <DataTable<ReturnRow>
        rows={filtered}
        defaultSort={{ key: "created_at", dir: "desc" }}
        empty={isLoading ? "Loading…" : "No returns yet"}
        columns={[
          { key: "number", label: "Return", render: (r) => (
            <Link to="/returns/$returnId" params={{ returnId: r.id }} className="font-mono text-xs text-primary hover:underline">{r.number}</Link>
          )},
          { key: "order", label: "Order", render: (r) => {
            const o = orderById.get(r.order_id);
            return o ? <Link to="/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-xs text-primary hover:underline">{o.number}</Link> : <span className="text-xs text-muted-foreground">—</span>;
          }},
          { key: "reason", label: "Reason", render: (r) => <span className="text-xs">{r.reason ?? "—"}</span> },
          { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
          { key: "created_at", label: "Created", sortAccessor: (r) => r.created_at, render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.created_at.slice(0, 10)}</span> },
        ]}
      />

      <FormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        title="New Return"
        description="Return numbers are generated automatically (RET-YYYY-####)."
        submitLabel="Create return"
        fields={[
          { name: "order_id", label: "Order", type: "select", required: true, options: orders.map((o) => ({ value: o.id, label: `${o.number} · ${o.status}` })) },
          { name: "reason", label: "Reason" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v: { order_id: string; reason?: string; notes?: string }) => {
          const o = orderById.get(v.order_id);
          await create.mutateAsync({
            order_id: v.order_id,
            customer_id: o?.customer_id ?? null,
            reason: v.reason || undefined,
            notes: v.notes || undefined,
          });
        }}
      />
    </div>
  );
}
