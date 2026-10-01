import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, ArrowRightLeft, Trash2, Timer, Pencil } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { AnalyticsCards } from "@/components/analytics-cards";
import { CSVExportButton } from "@/components/csv-export-button";
import { FormDialog } from "@/components/form-dialog";
import { useProducts, useRealtimeInvalidate } from "@/lib/oms-db";
import {
  invKey, useLocations, useInventoryLevels, useMovements, useSupply, useReservations, useAllocations, useSupplyDemand,
  useMove, useSetLevelStatus, useSaveSupply, useDeleteSupply, useRelease, useExpire, useDeallocate,
  checkAvailability, type InventoryLevel, type Movement, type Supply, type Reservation, type Allocation, type SupplyDemand, type Availability,
} from "@/lib/inventory-db";
import { formatDistanceToNow } from "date-fns";
import { AvailabilityBadge } from "@/components/availability-badge";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [
    { title: "Inventory · OMS" },
    { name: "description", content: "Stock by product and location, reservations, allocations, incoming supply and availability." },
    { property: "og:title", content: "Inventory · OMS" },
    { property: "og:description", content: "Stock by product and location, reservations, allocations, incoming supply and availability." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InventoryPage,
});

const TABS = ["Stock", "Movements", "Reservations", "Allocations", "Supply", "Supply vs Demand", "Availability check"] as const;
type Tab = typeof TABS[number];
const STATUSES = ["available", "hold", "quarantine", "damaged"];
const btn = "flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20";
const sel = "h-9 rounded-lg border border-border/60 bg-card/60 px-2 text-xs";

function InventoryPage() {
  for (const t of ["inventory_levels", "inventory_movements", "supply", "reservations", "allocations"]) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRealtimeInvalidate(t as never, [invKey]);
  }
  const [tab, setTab] = useState<Tab>("Stock");
  const [fProduct, setFProduct] = useState("all");
  const [fLoc, setFLoc] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [moveOpen, setMoveOpen] = useState<null | "receipt" | "issue" | "adjustment" | "transfer">(null);
  const [supplyEdit, setSupplyEdit] = useState<Partial<Supply> | null>(null);

  const { data: products = [] } = useProducts();
  const { data: locs = [] } = useLocations();
  const { data: levels = [], isLoading } = useInventoryLevels();
  const { data: moves = [] } = useMovements();
  const { data: supply = [] } = useSupply();
  const { data: res = [] } = useReservations();
  const { data: allocs = [] } = useAllocations();
  const { data: sd = [] } = useSupplyDemand();

  const move = useMove(); const setStatus = useSetLevelStatus();
  const saveSupply = useSaveSupply(); const delSupply = useDeleteSupply();
  const release = useRelease(); const expire = useExpire(); const dealloc = useDeallocate();

  const pMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const lMap = useMemo(() => Object.fromEntries(locs.map((l) => [l.id, l])), [locs]);
  const pName = (id?: string | null) => (id && pMap[id] ? `${pMap[id].sku} — ${pMap[id].name}` : "—");
  const lName = (id?: string | null) => (id && lMap[id] ? lMap[id].code : "—");
  const pOpts = products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }));
  const lOpts = locs.filter((l) => l.active).map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }));

  const match = (r: { product_id: string; location_id?: string | null; status?: string }) =>
    (fProduct === "all" || r.product_id === fProduct) && (fLoc === "all" || r.location_id === fLoc) && (fStatus === "all" || r.status === fStatus);
  const fLevels = levels.filter(match);
  const fMoves = moves.filter((m) => (fProduct === "all" || m.product_id === fProduct) && (fLoc === "all" || m.location_id === fLoc || m.to_location_id === fLoc));
  const fRes = res.filter(match); const fAlloc = allocs.filter(match); const fSupply = supply.filter(match);
  const fSd = sd.filter((r) => fProduct === "all" || r.product_id === fProduct);

  const newest = levels.reduce<string | null>((m, l) => (!m || l.last_updated > m ? l.last_updated : m), null);
  const cards = [
    { label: "On hand", value: levels.reduce((s, l) => s + Number(l.on_hand), 0).toLocaleString(), accent: "primary" as const },
    { label: "Reserved", value: levels.reduce((s, l) => s + Number(l.reserved), 0).toLocaleString(), accent: "warning" as const },
    { label: "Available", value: levels.filter((l) => l.status === "available").reduce((s, l) => s + Number(l.available), 0).toLocaleString(), accent: "success" as const },
    { label: "Incoming", value: sd.reduce((s, r) => s + Number(r.incoming), 0).toLocaleString(), accent: "info" as const },
    { label: "Active reservations", value: res.filter((r) => r.status === "active").length, accent: "accent" as const },
    { label: "Data freshness", value: newest ? formatDistanceToNow(new Date(newest), { addSuffix: true }) : "—", accent: "info" as const },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Inventory" subtitle={isLoading ? "Loading…" : `${levels.length} stock records across ${locs.length} locations`}
        actions={<div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => setMoveOpen("receipt")}><Plus className="h-3.5 w-3.5" /> Receive</button>
          <button className={btn} onClick={() => setMoveOpen("issue")}>Issue</button>
          <button className={btn} onClick={() => setMoveOpen("adjustment")}>Adjust</button>
          <button className={btn} onClick={() => setMoveOpen("transfer")}><ArrowRightLeft className="h-3.5 w-3.5" /> Transfer</button>
        </div>} />
      <AnalyticsCards cards={cards} />

      {locs.length === 0 && (
        <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          No locations yet. <Link to="/locations" className="text-primary hover:underline">Add a warehouse</Link> before receiving stock.
        </p>
      )}

      <div className="glass-panel flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-2.5 py-1 text-[11px] ${tab === t ? "border border-primary/30 bg-primary/15 text-primary" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <select className={sel} value={fProduct} onChange={(e) => setFProduct(e.target.value)}>
            <option value="all">All products</option>{pOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className={sel} value={fLoc} onChange={(e) => setFLoc(e.target.value)}>
            <option value="all">All locations</option>{locs.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
          </select>
          <select className={sel} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {[...STATUSES, "active", "released", "expired", "consumed", "allocated", "deallocated", "open", "received", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {tab === "Stock" && <>
        <div className="flex justify-end"><CSVExportButton filename="inventory" rows={fLevels} columns={[
          { key: "product", label: "Product", get: (r) => pName(r.product_id) }, { key: "location", label: "Location", get: (r) => lName(r.location_id) },
          { key: "on_hand", label: "On hand" }, { key: "reserved", label: "Reserved" }, { key: "available", label: "Available" },
          { key: "status", label: "Status" }, { key: "source_system", label: "Source" }, { key: "last_updated", label: "Last updated" },
        ]} /></div>
        <DataTable<InventoryLevel> rows={fLevels} empty="No stock yet — use Receive to add stock" columns={[
          { key: "product", label: "Product", sortAccessor: (r) => pName(r.product_id), render: (r) => <span className="text-xs">{pName(r.product_id)}</span> },
          { key: "location", label: "Location", sortAccessor: (r) => lName(r.location_id), render: (r) => <span className="font-mono text-xs">{lName(r.location_id)}</span> },
          { key: "on_hand", label: "On hand", align: "right", sortAccessor: (r) => Number(r.on_hand), render: (r) => <span className="font-mono text-xs">{Number(r.on_hand).toLocaleString()}</span> },
          { key: "reserved", label: "Reserved", align: "right", sortAccessor: (r) => Number(r.reserved), render: (r) => <span className="font-mono text-xs text-warning">{Number(r.reserved).toLocaleString()}</span> },
          { key: "available", label: "Available", align: "right", sortAccessor: (r) => Number(r.available), render: (r) => <span className="font-mono text-xs text-success">{Number(r.available).toLocaleString()}</span> },
          { key: "status", label: "Status", render: (r) => (
            <select value={r.status} onChange={(e) => setStatus.mutate({ id: r.id, status: e.target.value })} className="h-7 rounded border border-border/60 bg-card/60 px-1 text-[11px]">
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>) },
          { key: "source", label: "Source", render: (r) => <span className="text-xs text-muted-foreground">{r.source_system}</span> },
          { key: "last_updated", label: "Last updated", sortAccessor: (r) => r.last_updated, render: (r) => <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.last_updated), { addSuffix: true })}</span> },
        ]} />
      </>}

      {tab === "Movements" && <>
        <div className="flex justify-end"><CSVExportButton filename="inventory-movements" rows={fMoves} columns={[
          { key: "at", label: "When" }, { key: "type", label: "Type" }, { key: "product", label: "Product", get: (r) => pName(r.product_id) },
          { key: "from", label: "Location", get: (r) => lName(r.location_id) }, { key: "to", label: "To", get: (r) => lName(r.to_location_id) },
          { key: "qty", label: "Qty" }, { key: "reference", label: "Reference" },
        ]} /></div>
        <DataTable<Movement> rows={fMoves} empty="No stock movements yet" columns={[
          { key: "at", label: "When", sortAccessor: (r) => r.at, render: (r) => <span className="text-xs">{new Date(r.at).toLocaleString()}</span> },
          { key: "type", label: "Type", render: (r) => <span className="text-xs capitalize">{r.type}</span> },
          { key: "product", label: "Product", render: (r) => <span className="text-xs">{pName(r.product_id)}</span> },
          { key: "loc", label: "Location", render: (r) => <span className="font-mono text-xs">{lName(r.location_id)}{r.to_location_id ? ` → ${lName(r.to_location_id)}` : ""}</span> },
          { key: "qty", label: "Qty", align: "right", render: (r) => <span className="font-mono text-xs">{Number(r.qty).toLocaleString()}</span> },
          { key: "ref", label: "Reference", render: (r) => <span className="text-xs text-muted-foreground">{r.reference ?? "—"}</span> },
        ]} />
      </>}

      {tab === "Reservations" && <>
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={() => expire.mutate(undefined as never)}><Timer className="h-3.5 w-3.5" /> Release expired</button>
          <CSVExportButton filename="reservations" rows={fRes} columns={[
            { key: "order_id", label: "Order" }, { key: "product", label: "Product", get: (r) => pName(r.product_id) },
            { key: "loc", label: "Location", get: (r) => lName(r.location_id) }, { key: "qty", label: "Qty" }, { key: "status", label: "Status" }, { key: "expires_at", label: "Expires" },
          ]} />
        </div>
        <DataTable<Reservation> rows={fRes} empty="No reservations — reserve stock from a sales order" columns={[
          { key: "order", label: "Order", render: (r) => r.order_id ? <Link to="/orders/$orderId" params={{ orderId: r.order_id }} className="font-mono text-xs text-primary hover:underline">{r.order_id.slice(0, 8)}</Link> : "—" },
          { key: "product", label: "Product", render: (r) => <span className="text-xs">{pName(r.product_id)}</span> },
          { key: "loc", label: "Location", render: (r) => <span className="font-mono text-xs">{lName(r.location_id)}</span> },
          { key: "qty", label: "Qty", align: "right", render: (r) => <span className="font-mono text-xs">{r.qty}</span> },
          { key: "status", label: "Status", render: (r) => <span className="text-xs capitalize">{r.status}</span> },
          { key: "expires", label: "Expires", sortAccessor: (r) => r.expires_at ?? "", render: (r) => <span className="text-xs text-muted-foreground">{r.expires_at ? new Date(r.expires_at).toLocaleString() : "Never"}</span> },
          { key: "a", label: "", align: "right", render: (r) => r.status === "active" ? <button onClick={() => release.mutate(r.id)} className="text-xs text-destructive hover:underline">Release</button> : null },
        ]} />
      </>}

      {tab === "Allocations" && <>
        <div className="flex justify-end"><CSVExportButton filename="allocations" rows={fAlloc} columns={[
          { key: "order_id", label: "Order" }, { key: "product", label: "Product", get: (r) => pName(r.product_id) },
          { key: "loc", label: "Location", get: (r) => lName(r.location_id) }, { key: "qty", label: "Qty" }, { key: "status", label: "Status" },
        ]} /></div>
        <DataTable<Allocation> rows={fAlloc} empty="No allocations — allocate stock from a sales order" columns={[
          { key: "order", label: "Order", render: (r) => r.order_id ? <Link to="/orders/$orderId" params={{ orderId: r.order_id }} className="font-mono text-xs text-primary hover:underline">{r.order_id.slice(0, 8)}</Link> : "—" },
          { key: "product", label: "Product", render: (r) => <span className="text-xs">{pName(r.product_id)}</span> },
          { key: "loc", label: "Location", render: (r) => <span className="font-mono text-xs">{lName(r.location_id)}</span> },
          { key: "qty", label: "Qty", align: "right", render: (r) => <span className="font-mono text-xs">{r.qty}</span> },
          { key: "status", label: "Status", render: (r) => <span className="text-xs capitalize">{r.status}</span> },
          { key: "a", label: "", align: "right", render: (r) => r.status === "allocated" ? <button onClick={() => dealloc.mutate(r.id)} className="text-xs text-destructive hover:underline">Deallocate</button> : null },
        ]} />
      </>}

      {tab === "Supply" && <>
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={() => setSupplyEdit({})}><Plus className="h-3.5 w-3.5" /> Add expected supply</button>
          <CSVExportButton filename="supply" rows={fSupply} columns={[
            { key: "product", label: "Product", get: (r) => pName(r.product_id) }, { key: "source_type", label: "Source" }, { key: "reference", label: "Reference" },
            { key: "qty", label: "Qty" }, { key: "expected_date", label: "Expected" }, { key: "status", label: "Status" },
          ]} />
        </div>
        <p className="text-[11px] text-muted-foreground">Open production orders are counted as incoming supply automatically.</p>
        <DataTable<Supply> rows={fSupply} empty="No expected supply recorded" columns={[
          { key: "product", label: "Product", render: (r) => <span className="text-xs">{pName(r.product_id)}</span> },
          { key: "loc", label: "Location", render: (r) => <span className="font-mono text-xs">{lName(r.location_id)}</span> },
          { key: "src", label: "Source", render: (r) => <span className="text-xs capitalize">{r.source_type.replace(/_/g, " ")}</span> },
          { key: "ref", label: "Reference", render: (r) => <span className="text-xs">{r.reference ?? "—"}</span> },
          { key: "qty", label: "Qty", align: "right", render: (r) => <span className="font-mono text-xs">{r.qty}</span> },
          { key: "date", label: "Expected", sortAccessor: (r) => r.expected_date ?? "", render: (r) => <span className="text-xs">{r.expected_date ?? "—"}</span> },
          { key: "status", label: "Status", render: (r) => <span className="text-xs capitalize">{r.status}</span> },
          { key: "a", label: "", align: "right", render: (r) => (
            <div className="flex justify-end gap-2">
              {r.status === "open" && r.location_id && (
                <button className="text-xs text-success hover:underline" onClick={async () => {
                  await move.mutateAsync({ product: r.product_id, location: r.location_id!, type: "receipt", qty: Number(r.qty), reference: r.reference ?? "Supply receipt" });
                  await saveSupply.mutateAsync({ id: r.id, status: "received" });
                }}>Receive</button>)}
              <button onClick={() => setSupplyEdit(r)} aria-label="Edit"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
              <button onClick={() => delSupply.mutate(r.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
            </div>) },
        ]} />
      </>}

      {tab === "Supply vs Demand" && <>
        <div className="flex justify-end"><CSVExportButton filename="supply-demand" rows={fSd} columns={[
          { key: "sku", label: "SKU" }, { key: "name", label: "Product" }, { key: "demand", label: "Open demand" }, { key: "reserved", label: "Reserved" },
          { key: "on_hand", label: "On hand" }, { key: "incoming", label: "Incoming" }, { key: "net", label: "Net position", get: (r) => Number(r.on_hand) + Number(r.incoming) - Number(r.demand) },
        ]} /></div>
        <DataTable<SupplyDemand> rows={fSd} getRowId={(r) => r.product_id} columns={[
          { key: "sku", label: "SKU", sortAccessor: (r) => r.sku, render: (r) => <span className="font-mono text-xs">{r.sku}</span> },
          { key: "name", label: "Product", render: (r) => <span className="text-xs">{r.name}</span> },
          { key: "demand", label: "Open demand", align: "right", sortAccessor: (r) => Number(r.demand), render: (r) => <span className="font-mono text-xs">{Number(r.demand).toLocaleString()}</span> },
          { key: "reserved", label: "Reserved", align: "right", render: (r) => <span className="font-mono text-xs">{Number(r.reserved).toLocaleString()}</span> },
          { key: "on_hand", label: "On hand", align: "right", render: (r) => <span className="font-mono text-xs">{Number(r.on_hand).toLocaleString()}</span> },
          { key: "incoming", label: "Incoming", align: "right", render: (r) => <span className="font-mono text-xs">{Number(r.incoming).toLocaleString()}</span> },
          { key: "net", label: "Net position", align: "right", sortAccessor: (r) => Number(r.on_hand) + Number(r.incoming) - Number(r.demand), render: (r) => {
            const n = Number(r.on_hand) + Number(r.incoming) - Number(r.demand);
            return <span className={`font-mono text-xs font-semibold ${n < 0 ? "text-destructive" : "text-success"}`}>{n.toLocaleString()}</span>;
          } },
        ]} />
      </>}

      {tab === "Availability check" && <AvailabilityCheck options={pOpts} />}

      <FormDialog open={!!moveOpen} onOpenChange={(o) => !o && setMoveOpen(null)}
        title={moveOpen ? `Stock ${moveOpen}` : ""} submitLabel="Apply"
        description={moveOpen === "adjustment" ? "Use a negative quantity to reduce stock." : undefined}
        fields={[
          { name: "product", label: "Product", type: "select", options: pOpts, required: true },
          { name: "location", label: moveOpen === "transfer" ? "From location" : "Location", type: "select", options: lOpts, required: true },
          ...(moveOpen === "transfer" ? [{ name: "to", label: "To location", type: "select" as const, options: lOpts, required: true }] : []),
          { name: "qty", label: "Quantity", type: "number", required: true },
          { name: "reference", label: "Reference" },
        ]}
        onSubmit={async (v: any) => {
          await move.mutateAsync({ product: v.product, location: v.location, to: v.to || null, type: moveOpen!, qty: Number(v.qty), reference: v.reference || null });
          setMoveOpen(null);
        }} />

      <FormDialog open={!!supplyEdit} onOpenChange={(o) => !o && setSupplyEdit(null)} title={supplyEdit?.id ? "Edit supply" : "Expected supply"} submitLabel="Save"
        initial={supplyEdit ? { source_type: "purchase_order", status: "open", ...supplyEdit } : undefined}
        fields={[
          { name: "product_id", label: "Product", type: "select", options: pOpts, required: true },
          { name: "location_id", label: "Receiving location", type: "select", options: lOpts },
          { name: "source_type", label: "Source", type: "select", options: ["purchase_order", "transfer", "production", "other"].map((v) => ({ value: v, label: v.replace(/_/g, " ") })) },
          { name: "reference", label: "Reference (e.g. PO number)" },
          { name: "qty", label: "Quantity", type: "number", required: true },
          { name: "expected_date", label: "Expected date", type: "date" },
          { name: "status", label: "Status", type: "select", options: ["open", "received", "cancelled"].map((v) => ({ value: v, label: v })) },
        ]}
        onSubmit={async (v: any) => {
          if (!(Number(v.qty) > 0)) throw new Error("Quantity must be positive");
          await saveSupply.mutateAsync({ id: supplyEdit?.id, product_id: v.product_id, location_id: v.location_id || null, source_type: v.source_type, reference: v.reference || null, qty: Number(v.qty), expected_date: v.expected_date || null, status: v.status || "open" });
          setSupplyEdit(null);
        }} />
    </div>
  );
}

function AvailabilityCheck({ options }: { options: { value: string; label: string }[] }) {
  const [p, setP] = useState(""); const [q, setQ] = useState(1);
  const [r, setR] = useState<Availability | null>(null); const [busy, setBusy] = useState(false);
  return (
    <div className="glass-panel space-y-4 rounded-2xl p-4">
      <div className="flex flex-wrap gap-2">
        <select className={sel} value={p} onChange={(e) => setP(e.target.value)}>
          <option value="">— product —</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="number" min={1} value={q} onChange={(e) => setQ(Number(e.target.value) || 0)} className={`${sel} w-28`} />
        <button className={btn} disabled={!p || busy} onClick={async () => { setBusy(true); try { setR(await checkAvailability(p, q)); } finally { setBusy(false); } }}>Check</button>
      </div>
      {r && <AvailabilityBadge a={r} full />}
    </div>
  );
}
