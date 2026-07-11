import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { salesOrders, findCustomer, type SalesOrder, type SalesOrderStatus } from "@/lib/oms-data";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { permissionsFor } from "@/lib/roles";

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "Sales Orders · CORTA OMS" }] }),
  component: OrdersList,
});

const statusFilters: (SalesOrderStatus | "all")[] = ["all", "draft", "confirmed", "in_production", "partially_shipped", "shipped", "cancelled"];

function OrdersList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const role = useStore((s) => s.role);
  const perms = permissionsFor(role);

  const filtered = useMemo(() => {
    return salesOrders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (q) {
        const c = findCustomer(o.customerId)?.name.toLowerCase() ?? "";
        return o.number.toLowerCase().includes(q.toLowerCase()) || c.includes(q.toLowerCase());
      }
      return true;
    });
  }, [q, status]);

  const bulkAction = (label: string, count: number, cb: () => void) => {
    cb();
    toast.success(`${label}: ${count} order(s)`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales Orders"
        subtitle={`${filtered.length} of ${salesOrders.length} orders`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="sales-orders"
              rows={filtered}
              columns={[
                { key: "number", label: "Order #" },
                { key: "customer", label: "Customer", get: (o) => findCustomer(o.customerId)?.name },
                { key: "orderDate", label: "Order Date" },
                { key: "dueDate", label: "Due Date" },
                { key: "status", label: "Status" },
                { key: "lines", label: "Lines", get: (o) => o.lines.length },
                { key: "total", label: "Total" },
                { key: "currency", label: "Currency" },
              ]}
            />
            {perms.createOrder && (
              <button onClick={() => toast.success("New order (demo)")}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
                <Plus className="h-3.5 w-3.5" /> New Order
              </button>
            )}
          </div>
        }
      />

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by order # or customer…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {statusFilters.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize whitespace-nowrap ${status === s ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <DataTable<SalesOrder>
        rows={filtered}
        getRowId={(o) => o.id}
        defaultSort={{ key: "orderDate", dir: "desc" }}
        bulkActions={perms.editOrder ? (selected, clear) => (
          <>
            <button onClick={() => bulkAction("Marked confirmed", selected.length, clear)}
              className="rounded-md border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] text-success hover:bg-success/20">
              Confirm
            </button>
            <button onClick={() => bulkAction("Marked in production", selected.length, clear)}
              className="rounded-md border border-info/40 bg-info/10 px-2.5 py-1 text-[11px] text-info hover:bg-info/20">
              Send to Production
            </button>
            <button onClick={() => bulkAction("Cancelled", selected.length, clear)}
              className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] text-destructive hover:bg-destructive/20">
              Cancel
            </button>
            <CSVExportButton filename="sales-orders-selection" rows={selected} label="Export selection"
              columns={[
                { key: "number", label: "Order #" },
                { key: "customer", label: "Customer", get: (o) => findCustomer(o.customerId)?.name },
                { key: "status", label: "Status" },
                { key: "total", label: "Total" },
              ]} />
          </>
        ) : undefined}
        columns={[
          { key: "number", label: "Order", sortAccessor: (o) => o.number, render: (o) => (
            <Link to="/orders/$orderId" params={{ orderId: o.id }} className="font-mono text-xs text-primary hover:underline">{o.number}</Link>
          )},
          { key: "customer", label: "Customer", sortAccessor: (o) => findCustomer(o.customerId)?.name ?? "", render: (o) => <span className="text-sm">{findCustomer(o.customerId)?.name}</span> },
          { key: "orderDate", label: "Ordered", sortAccessor: (o) => o.orderDate, render: (o) => <span className="font-mono text-xs text-muted-foreground">{o.orderDate}</span> },
          { key: "dueDate", label: "Due", sortAccessor: (o) => o.dueDate, render: (o) => <span className="font-mono text-xs">{o.dueDate}</span> },
          { key: "lines", label: "Lines", sortAccessor: (o) => o.lines.length, render: (o) => <span className="font-mono text-xs">{o.lines.length}</span> },
          { key: "status", label: "Status", sortAccessor: (o) => o.status, render: (o) => <StatusPill status={o.status} /> },
          { key: "total", label: "Total", align: "right", sortAccessor: (o) => o.total, render: (o) => <span className="font-mono text-sm">${o.total.toLocaleString()}</span> },
        ]}
        empty="No orders match your filters"
      />
    </div>
  );
}
