import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { customers, salesOrders } from "@/lib/oms-data";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { toast } from "sonner";

export const Route = createFileRoute("/customers/")({
  head: () => ({ meta: [{ title: "Customers · CORTA OMS" }] }),
  component: CustomersList,
});

function CustomersList() {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const regions = useMemo(() => ["all", ...Array.from(new Set(customers.map((c) => c.address.split(",").pop()?.trim() ?? "—")))], []);
  const filtered = useMemo(() => customers.filter((c) => {
    if (region !== "all" && !c.address.includes(region)) return false;
    if (q) {
      const s = q.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.contact.toLowerCase().includes(s) || c.email.toLowerCase().includes(s);
    }
    return true;
  }), [q, region]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle={`${filtered.length} of ${customers.length} accounts`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="customers"
              rows={filtered}
              columns={[
                { key: "id", label: "ID" },
                { key: "name", label: "Name" },
                { key: "contact", label: "Contact" },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                { key: "address", label: "Address" },
                { key: "createdAt", label: "Onboarded" },
                { key: "orders", label: "Orders", get: (c) => salesOrders.filter((s) => s.customerId === c.id).length },
              ]}
            />
            <button onClick={() => toast.success("New customer (demo)")}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
              <Plus className="h-3.5 w-3.5" /> New Customer
            </button>
          </div>
        }
      />

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, contact, email…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {regions.map((r) => (
            <button key={r} onClick={() => setRegion(r)}
              className={`rounded-lg px-2.5 py-1 text-[11px] whitespace-nowrap ${region === r ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        rows={filtered}
        columns={[
          { key: "id", label: "ID", render: (c) => (
            <Link to="/customers/$customerId" params={{ customerId: c.id }} className="font-mono text-xs text-primary hover:underline">{c.id}</Link>
          )},
          { key: "name", label: "Name", render: (c) => <span className="text-sm font-medium">{c.name}</span> },
          { key: "contact", label: "Contact", render: (c) => <span className="text-xs">{c.contact}</span> },
          { key: "email", label: "Email", render: (c) => <span className="font-mono text-xs text-muted-foreground">{c.email}</span> },
          { key: "phone", label: "Phone", render: (c) => <span className="font-mono text-xs">{c.phone}</span> },
          { key: "orders", label: "Orders", align: "right", render: (c) => (
            <span className="font-mono text-xs">{salesOrders.filter((s) => s.customerId === c.id).length}</span>
          )},
        ]}
      />
    </div>
  );
}
