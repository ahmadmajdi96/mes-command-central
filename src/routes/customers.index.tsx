import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { customers, salesOrders } from "@/lib/oms-data";
import { PageHeader, DataTable } from "@/components/page-shell";

export const Route = createFileRoute("/customers/")({
  head: () => ({ meta: [{ title: "Customers · CORTA OMS" }] }),
  component: CustomersList,
});

function CustomersList() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} accounts`}
        actions={
          <button className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
            <Plus className="h-3.5 w-3.5" /> New Customer
          </button>
        }
      />
      <DataTable
        rows={customers}
        columns={[
          { key: "id", label: "ID", render: (c) => (
            <Link to="/customers/$customerId" params={{ customerId: c.id }} className="font-mono text-xs text-primary hover:underline">{c.id}</Link>
          )},
          { key: "name", label: "Name", render: (c) => <span className="text-sm font-medium">{c.name}</span> },
          { key: "contact", label: "Contact", render: (c) => <span className="text-xs">{c.contact}</span> },
          { key: "email", label: "Email", render: (c) => <span className="font-mono text-xs text-muted-foreground">{c.email}</span> },
          { key: "phone", label: "Phone", render: (c) => <span className="font-mono text-xs">{c.phone}</span> },
          { key: "orders", label: "Orders", align: "right", render: (c) => (
            <span className="font-mono text-xs">{salesOrders.filter(s => s.customerId === c.id).length}</span>
          )},
        ]}
      />
    </div>
  );
}
