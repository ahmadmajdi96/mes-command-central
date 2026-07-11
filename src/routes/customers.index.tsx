import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { FormDialog } from "@/components/form-dialog";
import { SavedPresetsBar } from "@/components/saved-presets-bar";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { permissionsFor } from "@/lib/roles";
import { useCustomers, useCreateCustomer, useOrders, useRealtimeInvalidate, customersKey, type Customer } from "@/lib/oms-db";

export const Route = createFileRoute("/customers/")({
  head: () => ({ meta: [{ title: "Customers · CORTA OMS" }] }),
  component: CustomersList,
});

type Preset = { q: string; region: string };

function CustomersList() {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [openNew, setOpenNew] = useState(false);
  const role = useStore((s) => s.role);
  const perms = permissionsFor(role);
  useRealtimeInvalidate("customers", [customersKey]);

  const { data: customers = [], isLoading } = useCustomers();
  const { data: orders = [] } = useOrders();
  const createCustomer = useCreateCustomer();

  const regions = useMemo(() => ["all", ...Array.from(new Set(customers.map((c) => c.address?.split(",").pop()?.trim() ?? "—")))], [customers]);
  const ordersOf = (id: string) => orders.filter((o) => o.customer_id === id).length;

  const filtered = useMemo(() => customers.filter((c) => {
    if (region !== "all" && !c.address?.includes(region)) return false;
    if (q) {
      const s = q.toLowerCase();
      return c.name.toLowerCase().includes(s)
        || (c.contact ?? "").toLowerCase().includes(s)
        || (c.email ?? "").toLowerCase().includes(s);
    }
    return true;
  }), [q, region, customers]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${customers.length} accounts`}
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="customers" rows={filtered}
              columns={[
                { key: "code", label: "Code" },
                { key: "name", label: "Name" },
                { key: "contact", label: "Contact" },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                { key: "address", label: "Address" },
                { key: "created_at", label: "Onboarded" },
                { key: "orders", label: "Orders", get: (c) => ordersOf(c.id) },
              ]}
            />
            {perms.createOrder && (
              <button onClick={() => setOpenNew(true)}
                className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
                <Plus className="h-3.5 w-3.5" /> New Customer
              </button>
            )}
          </div>
        }
      />

      <SavedPresetsBar<Preset> pageKey="customers" current={{ q, region }}
        onApply={(p) => { setQ(p.q ?? ""); setRegion(p.region ?? "all"); }} />

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

      <DataTable<Customer>
        rows={filtered}
        defaultSort={{ key: "name", dir: "asc" }}
        empty={isLoading ? "Loading…" : "No customers yet — create one to get started"}
        columns={[
          { key: "code", label: "Code", sortAccessor: (c) => c.code ?? "", render: (c) => (
            <Link to="/customers/$customerId" params={{ customerId: c.id }} className="font-mono text-xs text-primary hover:underline">{c.code ?? c.id.slice(0, 8)}</Link>
          )},
          { key: "name", label: "Name", sortAccessor: (c) => c.name, render: (c) => <span className="text-sm font-medium">{c.name}</span> },
          { key: "contact", label: "Contact", sortAccessor: (c) => c.contact ?? "", render: (c) => <span className="text-xs">{c.contact}</span> },
          { key: "email", label: "Email", sortAccessor: (c) => c.email ?? "", render: (c) => <span className="font-mono text-xs text-muted-foreground">{c.email}</span> },
          { key: "phone", label: "Phone", render: (c) => <span className="font-mono text-xs">{c.phone}</span> },
          { key: "orders", label: "Orders", align: "right", sortAccessor: (c) => ordersOf(c.id), render: (c) => (
            <span className="font-mono text-xs">{ordersOf(c.id)}</span>
          )},
        ]}
      />

      <FormDialog
        open={openNew}
        onOpenChange={setOpenNew}
        title="New Customer"
        submitLabel="Create customer"
        fields={[
          { name: "code", label: "Code", placeholder: "CUS-007" },
          { name: "name", label: "Name", required: true },
          { name: "contact", label: "Contact" },
          { name: "email", label: "Email", type: "email" },
          { name: "phone", label: "Phone" },
          { name: "address", label: "Address", type: "textarea" },
        ]}
        onSubmit={async (v: any) => {
          await createCustomer.mutateAsync(v);
          toast.success("Customer created");
        }}
      />
    </div>
  );
}
