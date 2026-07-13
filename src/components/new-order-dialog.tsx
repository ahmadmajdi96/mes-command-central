import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Info } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, useCustomers, useCreateOrder, orderStatusOptions, logAudit, ordersKey } from "@/lib/oms-db";
import { useQueryClient } from "@tanstack/react-query";

export type OrderLineInput = {
  product_id: string;
  qty: number;
  unit_price: number;
  due_date: string;
};

export function NewOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const createOrder = useCreateOrder();
  const qc = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("draft");
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLineInput[]>([]);

  useEffect(() => {
    if (open) {
      setCustomerId(""); setStatus("draft");
      setOrderDate(new Date().toISOString().slice(0, 10));
      setDueDate(""); setCurrency("USD"); setNotes("");
      setLines([]);
    }
  }, [open]);

  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);

  const addLine = () => {
    const p = products[0];
    setLines((l) => [...l, {
      product_id: p?.id ?? "",
      qty: 1,
      unit_price: Number((p as any)?.sale_price ?? 0),
      due_date: dueDate,
    }]);
  };
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));
  const patchLine = (i: number, patch: Partial<OrderLineInput>) =>
    setLines((l) => l.map((row, idx) => {
      if (idx !== i) return row;
      const next = { ...row, ...patch };
      // When product changes, auto-fill unit_price from product.sale_price
      if (patch.product_id && patch.product_id !== row.product_id) {
        const prod = productMap[patch.product_id];
        next.unit_price = Number((prod as any)?.sale_price ?? 0);
      }
      return next;
    }));

  const previews = useMemo(() =>
    lines.map((l) => {
      const prod = productMap[l.product_id];
      const limit = Number(prod?.batching_limit ?? 0);
      const qty = Number(l.qty) || 0;
      if (!limit || limit <= 0 || qty <= limit) return { batches: 1, size: qty };
      return { batches: Math.ceil(qty / limit), size: limit };
    }), [lines, productMap]);

  const total = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0),
    [lines],
  );
  const costTotal = useMemo(
    () => lines.reduce((s, l) => {
      const c = Number((productMap[l.product_id] as any)?.standard_cost ?? 0);
      return s + (Number(l.qty) || 0) * c;
    }, 0),
    [lines, productMap],
  );

  const submit = async () => {
    if (!customerId) return toast.error("Select a customer");
    if (lines.length === 0) return toast.error("Add at least one product line");
    for (const [i, l] of lines.entries()) {
      if (!l.product_id) return toast.error(`Line ${i + 1}: pick a product`);
      if (!(Number(l.qty) > 0)) return toast.error(`Line ${i + 1}: qty must be > 0`);
    }
    try {
      setBusy(true);
      const created = await createOrder.mutateAsync({
        customer_id: customerId,
        status,
        order_date: orderDate,
        due_date: dueDate || null,
        total,
        currency,
        notes: notes || null,
      });

      // One sales_order_line per product. Batching is applied later when the order
      // is sent to production (explodeOrderToProduction reads product.batching_limit).
      const rows = lines.map((l) => ({
        order_id: created.id,
        product_id: l.product_id,
        qty: Number(l.qty) || 0,
        unit_price: Number(l.unit_price) || 0,
        due_date: l.due_date || null,
        status: "pending",
      }));
      const { error } = await supabase.from("sales_order_lines").insert(rows);
      if (error) throw error;

      await logAudit("sales_order.lines", created.id, `Added ${rows.length} line(s)`);
      qc.invalidateQueries({ queryKey: ordersKey });
      toast.success(`Order ${created.number} created — ${rows.length} line(s)`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Sales Order</DialogTitle>
          <DialogDescription>Order # auto-generated (SO-YYYY-####). Unit price auto-fills from each product's sale price; batches are created only when the order is sent to production.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Labeled label="Customer *">
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm">
                <option value="">— select —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Labeled>
            <Labeled label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm">
                {orderStatusOptions.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </Labeled>
            <Labeled label="Order date">
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm" />
            </Labeled>
            <Labeled label="Due date">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm" />
            </Labeled>
            <Labeled label="Currency">
              <input value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm" />
            </Labeled>
            <Labeled label="Revenue total (auto)">
              <div className="flex h-9 items-center rounded-lg border border-border/60 bg-card/40 px-3 font-mono text-sm">
                {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Labeled>
            <Labeled label="Cost total (auto)">
              <div className="flex h-9 items-center rounded-lg border border-border/60 bg-card/40 px-3 font-mono text-sm text-muted-foreground">
                {currency} {costTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Labeled>
            <Labeled label="Margin (auto)">
              <div className="flex h-9 items-center rounded-lg border border-border/60 bg-card/40 px-3 font-mono text-sm">
                {currency} {(total - costTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Labeled>
          </div>

          <Labeled label="Notes">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-card/60 p-2 text-sm" />
          </Labeled>

          <div className="glass-panel rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                Order Items ({lines.length})
              </div>
              <button type="button" onClick={addLine}
                className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-primary">
                <Plus className="h-3 w-3" /> Add product
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                No items yet. Add a product to build this order.
              </p>
            ) : (
              <div className="space-y-2">
                {lines.map((l, i) => {
                  const prod = productMap[l.product_id];
                  const preview = previews[i];
                  const limit = Number(prod?.batching_limit ?? 0);
                  return (
                    <div key={i} className="rounded-lg border border-border/60 bg-card/40 p-2">
                      <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
                        <select value={l.product_id} onChange={(e) => patchLine(i, { product_id: e.target.value })}
                          className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs">
                          <option value="">— product —</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                        </select>
                        <input type="number" min={0} value={l.qty}
                          onChange={(e) => patchLine(i, { qty: Number(e.target.value) || 0 })}
                          placeholder="Qty" className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs" />
                        <input type="date" value={l.due_date}
                          onChange={(e) => patchLine(i, { due_date: e.target.value })}
                          className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs" />
                        <button type="button" onClick={() => removeLine(i)}
                          className="rounded-md border border-destructive/40 bg-destructive/10 p-1.5 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 pl-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          Unit price: <span className="font-mono text-foreground/80">{currency} {Number(l.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </span>
                        <span className="inline-flex items-center gap-1"><Info className="h-3 w-3" />
                          Batching limit: <span className="font-mono">{limit > 0 ? limit : "—"}</span>
                        </span>
                        {preview.batches > 1 ? (
                          <span className="text-info">
                            → {preview.batches} batch(es) of {preview.size} {prod?.uom ?? ""} on production
                          </span>
                        ) : (
                          <span>→ 1 batch on production</span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          Cost: <span className="font-mono">{currency} {Number((prod as any)?.standard_cost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </span>
                        <span className="ml-auto font-mono text-foreground/80">
                          {currency} {((Number(l.qty) || 0) * (Number(l.unit_price) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary disabled:opacity-50">
            {busy ? "Creating…" : "Create order"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
