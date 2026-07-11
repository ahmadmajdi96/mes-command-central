import { createFileRoute, Link } from "@tanstack/react-router";
import { inventory, findProduct, findWorkstation, inventoryTxns, type InventoryLine, type InventoryTxn } from "@/lib/oms-data";
import { PageHeader, Panel, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Edit } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { permissionsFor } from "@/lib/roles";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory · CORTA OMS" }] }),
  component: InventoryPage,
});

const iconFor = (type: string) => {
  if (type === "receipt") return <ArrowDownCircle className="h-4 w-4 text-success" />;
  if (type === "issue") return <ArrowUpCircle className="h-4 w-4 text-warning" />;
  if (type === "transfer") return <ArrowLeftRight className="h-4 w-4 text-info" />;
  return <Edit className="h-4 w-4 text-accent" />;
};

function InventoryPage() {
  const role = useStore((s) => s.role);
  const perms = permissionsFor(role);
  const [q, setQ] = useState("");
  const [txnType, setTxnType] = useState("all");
  const totalOnHand = inventory.reduce((s, i) => s + i.qty, 0);
  const totalReserved = inventory.reduce((s, i) => s + i.reserved, 0);

  const filteredTxns = useMemo(() => inventoryTxns.filter((t) => {
    if (txnType !== "all" && t.type !== txnType) return false;
    if (!q) return true;
    const p = findProduct(t.productId);
    const s = q.toLowerCase();
    return t.id.toLowerCase().includes(s) || t.ref.toLowerCase().includes(s) || (p?.sku.toLowerCase().includes(s) ?? false);
  }), [q, txnType]);

  const filteredStock = useMemo(() => inventory.filter((i) => {
    if (!q) return true;
    const p = findProduct(i.productId);
    const s = q.toLowerCase();
    return (p?.sku.toLowerCase().includes(s) ?? false) || (p?.name.toLowerCase().includes(s) ?? false);
  }), [q]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        subtitle="Real-time stock on hand and reservations"
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="inventory-transactions"
              rows={filteredTxns}
              columns={[
                { key: "id", label: "Txn ID" },
                { key: "at", label: "Timestamp" },
                { key: "type", label: "Type" },
                { key: "product", label: "Product", get: (t) => findProduct(t.productId)?.sku },
                { key: "qty", label: "Quantity" },
                { key: "ref", label: "Reference" },
                { key: "user", label: "User" },
              ]}
              label="Export Txns"
            />
            {perms.adjustInventory && (
              <>
                <button onClick={() => toast.success("Receive stock (demo)")} className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">Receive</button>
                <button onClick={() => toast.success("Issue stock (demo)")} className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">Issue</button>
                <button onClick={() => toast.success("Transfer stock (demo)")} className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs">Transfer</button>
                <button onClick={() => toast.success("Adjust stock (demo)")} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">Adjust Stock</button>
              </>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">On Hand (units)</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-primary text-glow">{totalOnHand.toLocaleString()}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Reserved</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-warning">{totalReserved.toLocaleString()}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Available</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-success">{(totalOnHand - totalReserved).toLocaleString()}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Locations</div>
          <div className="mt-2 font-mono text-2xl font-semibold">{new Set(inventory.map((i) => i.workstationId ?? "WH")).size}</div>
        </Panel>
      </div>

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by SKU, product, txn ref…"
          className="h-9 flex-1 min-w-[240px] rounded-lg border border-border/60 bg-card/60 px-3 text-sm focus:border-primary/50 focus:outline-none" />
        <div className="flex items-center gap-1">
          {["all", "receipt", "issue", "transfer", "adjust"].map((t) => (
            <button key={t} onClick={() => setTxnType(t)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${txnType === t ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Stock by Product / Location</h3>
          <DataTable<InventoryLine>
            rows={filteredStock}
            defaultSort={{ key: "qty", dir: "desc" }}
            columns={[
              { key: "product", label: "Product", sortAccessor: (i) => findProduct(i.productId)?.name ?? "", render: (i) => {
                const p = findProduct(i.productId);
                return (
                  <div>
                    <Link to="/products/$productId" params={{ productId: i.productId }} className="text-sm text-primary hover:underline">{p?.name}</Link>
                    <div className="font-mono text-[11px] text-muted-foreground">{p?.sku}</div>
                  </div>
                );
              }},
              { key: "loc", label: "Location", sortAccessor: (i) => i.workstationId ?? "WH", render: (i) => <span className="text-xs">{i.workstationId ? findWorkstation(i.workstationId)?.name : "Main Warehouse"}</span> },
              { key: "qty", label: "On Hand", align: "right", sortAccessor: (i) => i.qty, render: (i) => {
                const p = findProduct(i.productId);
                return <span className="font-mono text-sm">{i.qty.toLocaleString()} <span className="text-muted-foreground">{p?.uom}</span></span>;
              }},
              { key: "res", label: "Reserved", align: "right", sortAccessor: (i) => i.reserved, render: (i) => <span className="font-mono text-sm text-warning">{i.reserved.toLocaleString()}</span> },
              { key: "avail", label: "Available", align: "right", sortAccessor: (i) => i.qty - i.reserved, render: (i) => <span className="font-mono text-sm text-success">{(i.qty - i.reserved).toLocaleString()}</span> },
            ]}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Transactions</h3>
          <DataTable<InventoryTxn>
            rows={filteredTxns}
            defaultSort={{ key: "at", dir: "desc" }}
            columns={[
              { key: "at", label: "When", sortAccessor: (t) => t.at, render: (t) => <span className="font-mono text-[11px] text-muted-foreground">{t.at}</span> },
              { key: "type", label: "Type", sortAccessor: (t) => t.type, render: (t) => (
                <span className="inline-flex items-center gap-1.5 text-xs capitalize">{iconFor(t.type)} {t.type}</span>
              )},
              { key: "product", label: "Product", sortAccessor: (t) => findProduct(t.productId)?.sku ?? "", render: (t) => {
                const p = findProduct(t.productId);
                return <span className="font-mono text-xs">{p?.sku}</span>;
              }},
              { key: "qty", label: "Qty", align: "right", sortAccessor: (t) => t.qty, render: (t) => (
                <span className={`font-mono text-xs ${t.qty > 0 ? "text-success" : "text-destructive"}`}>{t.qty > 0 ? "+" : ""}{t.qty.toLocaleString()}</span>
              )},
              { key: "ref", label: "Reference", sortAccessor: (t) => t.ref, render: (t) => <span className="text-xs">{t.ref}</span> },
              { key: "user", label: "User", sortAccessor: (t) => t.user, render: (t) => <span className="font-mono text-[11px] text-muted-foreground">{t.user}</span> },
              { key: "id", label: "Txn ID", render: (t) => <span className="font-mono text-[10px] text-muted-foreground">{t.id}</span> },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
