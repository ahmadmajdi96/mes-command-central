import { createFileRoute, Link } from "@tanstack/react-router";
import { inventory, findProduct, findWorkstation, inventoryTxns } from "@/lib/oms-data";
import { PageHeader, Panel } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Edit } from "lucide-react";
import { useState } from "react";
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
  const totalOnHand = inventory.reduce((s, i) => s + i.qty, 0);
  const totalReserved = inventory.reduce((s, i) => s + i.reserved, 0);

  const filteredTxns = inventoryTxns.filter((t) => {
    if (!q) return true;
    const p = findProduct(t.productId);
    const s = q.toLowerCase();
    return t.id.toLowerCase().includes(s) || t.ref.toLowerCase().includes(s) || (p?.sku.toLowerCase().includes(s) ?? false);
  });

  const filteredStock = inventory.filter((i) => {
    if (!q) return true;
    const p = findProduct(i.productId);
    const s = q.toLowerCase();
    return (p?.sku.toLowerCase().includes(s) ?? false) || (p?.name.toLowerCase().includes(s) ?? false);
  });

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

      <div className="glass-panel rounded-2xl p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by SKU, product, txn ref…"
          className="h-9 w-full rounded-lg border border-border/60 bg-card/60 px-3 text-sm focus:border-primary/50 focus:outline-none" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Stock by Product / Location</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium text-right">On Hand</th>
                  <th className="pb-2 font-medium text-right">Reserved</th>
                  <th className="pb-2 font-medium text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map((i, idx) => {
                  const p = findProduct(i.productId);
                  return (
                    <tr key={idx} className="border-b border-border/30 hover:bg-card/60">
                      <td className="py-3">
                        <Link to="/products/$productId" params={{ productId: i.productId }} className="text-sm text-primary hover:underline">{p?.name}</Link>
                        <div className="font-mono text-[11px] text-muted-foreground">{p?.sku}</div>
                      </td>
                      <td className="py-3 text-xs">{i.workstationId ? findWorkstation(i.workstationId)?.name : "Main Warehouse"}</td>
                      <td className="py-3 text-right font-mono text-sm">{i.qty.toLocaleString()} <span className="text-muted-foreground">{p?.uom}</span></td>
                      <td className="py-3 text-right font-mono text-sm text-warning">{i.reserved.toLocaleString()}</td>
                      <td className="py-3 text-right font-mono text-sm text-success">{(i.qty - i.reserved).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Recent Transactions</h3>
          <div className="space-y-2">
            {filteredTxns.map((t) => {
              const p = findProduct(t.productId);
              return (
                <div key={t.id} className="flex items-start gap-2 rounded-lg border border-border/60 bg-card/40 p-2.5">
                  {iconFor(t.type)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium capitalize">{t.type}</span>
                      <span className={`font-mono text-xs ${t.qty > 0 ? "text-success" : "text-destructive"}`}>{t.qty > 0 ? "+" : ""}{t.qty.toLocaleString()}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{p?.sku} · {t.ref}</div>
                    <div className="text-[10px] text-muted-foreground">{t.at} · {t.user}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
