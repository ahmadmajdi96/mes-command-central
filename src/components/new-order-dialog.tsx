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

  const addLine = () =>
    setLines((l) => [...l, { product_id: products[0]?.id ?? "", qty: 1, unit_price: 0, due_date: dueDate }]);
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));
  const patchLine = (i: number, patch: Partial<OrderLineInput>) =>
    setLines((l) => l.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

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

      // Split each line by batching_limit and insert
      const rows: Array<{
        order_id: string;
        product_id: string;
        qty: number;
        unit_price: number;
        due_date: string | null;
        batch_index: number | null;
        batch_of: number | null;
        status: string;
      }> = [];
      for (const l of lines) {
        const prod = productMap[l.product_id];
        const limit = Number(prod?.batching_limit ?? 0);
        const qty = Number(l.qty);
        const price = Number(l.unit_price) || 0;
        const due = l.due_date || null;
        if (!limit || limit <= 0 || qty <= limit) {
          rows.push({
            order_id: created.id, product_id: l.product_id, qty, unit_price: price,
            due_date: due, batch_index: null, batch_of: null, status: "pending",
          });
        } else {
          const count = Math.ceil(qty / limit);
          let remaining = qty;
          for (let i = 1; i <= count; i++) {
            const size = Math.min(limit, remaining);
            rows.push({
              order_id: created.id, product_id: l.product_id, qty: size, unit_price: price,
              due_date: due, batch_index: i, batch_of: count, status: "pending",
            });
            remaining -= size;
          }
        }
      }
      const { error } = await supabase.from("sales_order_lines").insert(rows);
      if (error) throw error;

      await logAudit("sales_order.lines", created.id, `Added ${rows.length} line(s) across ${lines.length} product(s)`);
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
          <DialogDescription>Order # auto-generated (SO-YYYY-####). Lines exceeding a product's batching limit split automatically.</DialogDescription>
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
            <Labeled label="Total (auto)">
              <div className="flex h-9 items-center rounded-lg border border-border/60 bg-card/40 px-3 font-mono text-sm">
                {currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      <div className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                        <select value={l.product_id} onChange={(e) => patchLine(i, { product_id: e.target.value })}
                          className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs">
                          <option value="">— product —</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                        </select>
                        <input type="number" min={0} value={l.qty}
                          onChange={(e) => patchLine(i, { qty: Number(e.target.value) || 0 })}
                          placeholder="Qty" className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs" />
                        <input type="number" min={0} step={0.01} value={l.unit_price}
                          onChange={(e) => patchLine(i, { unit_price: Number(e.target.value) || 0 })}
                          placeholder="Unit price" className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs" />
                        <input type="date" value={l.due_date}
                          onChange={(e) => patchLine(i, { due_date: e.target.value })}
                          className="h-9 rounded-md border border-border/60 bg-card/60 px-2 text-xs" />
                        <button type="button" onClick={() => removeLine(i)}
                          className="rounded-md border border-destructive/40 bg-destructive/10 p-1.5 text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 pl-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Info className="h-3 w-3" />
                          Batching limit: <span className="font-mono">{limit > 0 ? limit : "—"}</span>
                        </span>
                        {preview.batches > 1 ? (
                          <span className="text-info">
                            → will split into <span className="font-mono">{preview.batches}</span> batch lines of{" "}
                            <span className="font-mono">{preview.size}</span> {prod?.uom ?? ""}
                            {Number(l.qty) % (limit || 1) !== 0 && (
                              <> (last {(Number(l.qty) - preview.size * (preview.batches - 1))})</>
                            )}
                          </span>
                        ) : (
                          <span>→ single line</span>
                        )}
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
