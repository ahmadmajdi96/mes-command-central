import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { FormDialog } from "@/components/form-dialog";
import { SavedPresetsBar } from "@/components/saved-presets-bar";
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, Edit } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { permissionsFor } from "@/lib/roles";
import {
  useInventoryTxns, useCreateInventoryTxn, useProducts, useWorkOrders, useOrders,
  useRealtimeInvalidate, inventoryKey, inventoryTypeOptions, type InventoryTxnWithProduct,
} from "@/lib/oms-db";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory · CORTA OMS" }] }),
  component: InventoryPage,
});

type Preset = { q: string; txnType: string };

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
  const [newType, setNewType] = useState<string | null>(null);
  useRealtimeInvalidate("inventory_transactions", [inventoryKey]);

  const { data: txns = [], isLoading } = useInventoryTxns();
  const { data: products = [] } = useProducts();
  const { data: workOrders = [] } = useWorkOrders();
  const { data: orders = [] } = useOrders();
  const createTxn = useCreateInventoryTxn();

  const filteredTxns = useMemo(() => txns.filter((t) => {
    if (txnType !== "all" && t.type !== txnType) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (t.reference ?? "").toLowerCase().includes(s)
      || (t.product?.sku ?? "").toLowerCase().includes(s)
      || (t.product?.name ?? "").toLowerCase().includes(s);
  }), [q, txnType, txns]);

  const stockByProduct = useMemo(() => {
    const map = new Map<string, { product: any; qty: number }>();
    for (const t of txns) {
      if (!t.product_id || !t.product) continue;
      const cur = map.get(t.product_id) ?? { product: t.product, qty: 0 };
      cur.qty += Number(t.qty);
      map.set(t.product_id, cur);
    }
    return Array.from(map.values()).filter((r) => !q || r.product.sku.toLowerCase().includes(q.toLowerCase()) || r.product.name.toLowerCase().includes(q.toLowerCase()));
  }, [txns, q]);

  const totalOnHand = stockByProduct.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventory"
        subtitle="Real-time stock movements and reservations"
        actions={
          <div className="flex items-center gap-2">
            <CSVExportButton
              filename="inventory-transactions"
              rows={filteredTxns}
              columns={[
                { key: "id", label: "Txn ID" },
                { key: "at", label: "Timestamp" },
                { key: "type", label: "Type" },
                { key: "product", label: "SKU", get: (t) => t.product?.sku ?? "" },
                { key: "qty", label: "Quantity" },
                { key: "reference", label: "Reference" },
                { key: "work_order_id", label: "Work Order" },
                { key: "order_id", label: "Sales Order" },
              ]}
              label="Export Txns"
            />
            {perms.adjustInventory && inventoryTypeOptions.map((t) => (
              <button key={t} onClick={() => setNewType(t)}
                className="rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs capitalize">{t}</button>
            ))}
          </div>
        }
      />

      <SavedPresetsBar<Preset> pageKey="inventory" current={{ q, txnType }}
        onApply={(p) => { setQ(p.q ?? ""); setTxnType(p.txnType ?? "all"); }} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Net On Hand</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-primary text-glow">{totalOnHand.toLocaleString()}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Products Tracked</div>
          <div className="mt-2 font-mono text-2xl font-semibold">{stockByProduct.length}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Total Transactions</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-info">{txns.length.toLocaleString()}</div>
        </Panel>
        <Panel>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Last 24h</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-success">
            {txns.filter((t) => Date.now() - new Date(t.at).getTime() < 86400000).length}
          </div>
        </Panel>
      </div>

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by SKU, product, reference…"
          className="h-9 flex-1 min-w-[240px] rounded-lg border border-border/60 bg-card/60 px-3 text-sm focus:border-primary/50 focus:outline-none" />
        <div className="flex items-center gap-1">
          {["all", ...inventoryTypeOptions].map((t) => (
            <button key={t} onClick={() => setTxnType(t)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${txnType === t ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Stock by Product</h3>
          <DataTable
            rows={stockByProduct}
            defaultSort={{ key: "qty", dir: "desc" }}
            empty={isLoading ? "Loading…" : "No stock data yet"}
            columns={[
              { key: "product", label: "Product", sortAccessor: (r) => r.product.name, render: (r) => (
                <div>
                  <Link to="/products/$productId" params={{ productId: r.product.id }} className="text-sm text-primary hover:underline">{r.product.name}</Link>
                  <div className="font-mono text-[11px] text-muted-foreground">{r.product.sku}</div>
                </div>
              )},
              { key: "qty", label: "On Hand", align: "right", sortAccessor: (r) => r.qty, render: (r) => (
                <span className={`font-mono text-sm ${r.qty < 0 ? "text-destructive" : ""}`}>{r.qty.toLocaleString()} <span className="text-muted-foreground">{r.product.uom}</span></span>
              )},
            ]}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Transactions</h3>
          <DataTable<InventoryTxnWithProduct>
            rows={filteredTxns}
            defaultSort={{ key: "at", dir: "desc" }}
            empty={isLoading ? "Loading…" : "No transactions"}
            columns={[
              { key: "at", label: "When", sortAccessor: (t) => t.at, render: (t) => <span className="font-mono text-[11px] text-muted-foreground">{new Date(t.at).toLocaleString()}</span> },
              { key: "type", label: "Type", sortAccessor: (t) => t.type, render: (t) => (
                <span className="inline-flex items-center gap-1.5 text-xs capitalize">{iconFor(t.type)} {t.type}</span>
              )},
              { key: "product", label: "Product", sortAccessor: (t) => t.product?.sku ?? "", render: (t) => (
                <span className="font-mono text-xs">{t.product?.sku ?? "—"}</span>
              )},
              { key: "qty", label: "Qty", align: "right", sortAccessor: (t) => Number(t.qty), render: (t) => (
                <span className={`font-mono text-xs ${Number(t.qty) > 0 ? "text-success" : "text-destructive"}`}>{Number(t.qty) > 0 ? "+" : ""}{Number(t.qty).toLocaleString()}</span>
              )},
              { key: "ref", label: "Reference", sortAccessor: (t) => t.reference ?? "", render: (t) => <span className="text-xs">{t.reference ?? "—"}</span> },
              { key: "wo", label: "WO", render: (t) => t.work_order_id ? (
                <Link to="/work-orders/$woId" params={{ woId: t.work_order_id }} className="font-mono text-[11px] text-primary hover:underline">wo</Link>
              ) : <span className="text-[11px] text-muted-foreground">—</span> },
              { key: "so", label: "SO", render: (t) => t.order_id ? (
                <Link to="/orders/$orderId" params={{ orderId: t.order_id }} className="font-mono text-[11px] text-primary hover:underline">so</Link>
              ) : <span className="text-[11px] text-muted-foreground">—</span> },
              { key: "id", label: "Txn", render: (t) => <span className="font-mono text-[10px] text-muted-foreground">{t.id.slice(0, 8)}</span> },
            ]}
          />
        </div>
      </div>

      <FormDialog
        open={!!newType}
        onOpenChange={(v) => !v && setNewType(null)}
        title={`${newType ? newType[0].toUpperCase() + newType.slice(1) : ""} inventory`}
        submitLabel="Post transaction"
        fields={[
          { name: "product_id", label: "Product", type: "select", required: true,
            options: products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` })) },
          { name: "qty", label: `Quantity ${newType === "issue" ? "(will be negated)" : ""}`, type: "number", required: true, step: 0.01 },
          { name: "reference", label: "Reference", placeholder: "GR-4412, cycle count, etc." },
          { name: "work_order_id", label: "Work Order (optional)", type: "select",
            options: workOrders.map((w) => ({ value: w.id, label: w.number })) },
          { name: "order_id", label: "Sales Order (optional)", type: "select",
            options: orders.map((o) => ({ value: o.id, label: o.number })) },
        ]}
        onSubmit={async (v: any) => {
          if (!newType) return;
          const qty = newType === "issue" ? -Math.abs(Number(v.qty)) : Number(v.qty);
          await createTxn.mutateAsync({
            type: newType, qty,
            product_id: v.product_id || null,
            reference: v.reference || null,
            work_order_id: v.work_order_id || null,
            order_id: v.order_id || null,
          });
          toast.success("Transaction posted");
        }}
      />
    </div>
  );
}
