import { useState } from "react";
import { Star, Plus, Edit, Trash2, MessageSquare, CheckCircle2, X } from "lucide-react";
import { Panel } from "@/components/page-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useOrderFeedback,
  useCreateFeedback,
  useUpdateFeedback,
  useDeleteFeedback,
  type OrderFeedback,
  type ProductRating,
} from "@/lib/order-feedback-db";
import { usePermission } from "@/lib/permissions";

const CATEGORIES = ["general", "quality", "delivery", "communication", "pricing"];

export interface OrderLineForFeedback {
  id: string;
  product?: { id: string; sku: string; name: string } | null;
}

export function OrderFeedbackSection({ orderId, orderLines = [] }: { orderId: string; orderLines?: OrderLineForFeedback[] }) {
  const { data: rows = [], isLoading } = useOrderFeedback(orderId);
  const create = useCreateFeedback(orderId);
  const update = useUpdateFeedback(orderId);
  const del = useDeleteFeedback(orderId);
  const canCreate = usePermission("feedback", "create");
  const canUpdate = usePermission("feedback", "update");
  const canDelete = usePermission("feedback", "delete");

  const products = orderLines
    .map((l) => l.product)
    .filter((p): p is { id: string; sku: string; name: string } => !!p)
    // dedupe by id
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<OrderFeedback | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("general");
  const [comments, setComments] = useState<string[]>([""]);
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [productRatings, setProductRatings] = useState<ProductRating[]>([]);

  const startCreate = () => {
    setEditing(null);
    setRating(5); setCategory("general"); setComments([""]); setStatus("open"); setProductRatings([]);
    setOpenForm(true);
  };
  const startEdit = (r: OrderFeedback) => {
    setEditing(r);
    setRating(r.rating);
    setCategory(r.category);
    const initialComments = r.comments && r.comments.length > 0 ? r.comments : r.comment ? [r.comment] : [""];
    setComments(initialComments);
    setStatus(r.status);
    setProductRatings(r.product_ratings ?? []);
    setOpenForm(true);
  };

  const submit = async () => {
    const cleanComments = comments.map((c) => c.trim()).filter(Boolean);
    const payload = {
      rating,
      category,
      comment: cleanComments.join("\n") || null,
      comments: cleanComments,
      product_ratings: productRatings,
      status,
    };
    if (editing) {
      await update.mutateAsync({ id: editing.id, patch: payload as Partial<OrderFeedback> });
    } else {
      await create.mutateAsync(payload);
    }
    setOpenForm(false);
  };

  const setProductRating = (product_id: string, r: number) => {
    setProductRatings((prev) => {
      const existing = prev.find((p) => p.product_id === product_id);
      if (existing) return prev.map((p) => p.product_id === product_id ? { ...p, rating: r } : p);
      return [...prev, { product_id, rating: r }];
    });
  };
  const removeProductRating = (product_id: string) => {
    setProductRatings((prev) => prev.filter((p) => p.product_id !== product_id));
  };

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Client Feedback</h3>
          <span className="text-[11px] text-muted-foreground">({rows.length})</span>
        </div>
        {canCreate && (
          <button onClick={startCreate}
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20">
            <Plus className="h-3.5 w-3.5" /> Add feedback
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No feedback yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StarRow value={r.rating} />
                    <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{r.category}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${r.status === "resolved" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {r.status === "resolved" && <CheckCircle2 className="h-3 w-3" />} {r.status}
                    </span>
                  </div>
                  {r.comments && r.comments.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-sm">
                      {r.comments.map((c, i) => (
                        <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{c}</span></li>
                      ))}
                    </ul>
                  )}
                  {(!r.comments || r.comments.length === 0) && r.comment && <p className="mt-1.5 text-sm whitespace-pre-line">{r.comment}</p>}
                  {r.product_ratings && r.product_ratings.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.product_ratings.map((pr) => {
                        const p = products.find((x) => x.id === pr.product_id);
                        return (
                          <div key={pr.product_id} className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-2 py-1 text-[11px]">
                            <span className="font-mono text-muted-foreground">{p ? p.sku : pr.product_id.slice(0, 8)}</span>
                            <StarRow value={pr.rating} size="sm" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  {canUpdate && (
                    <button onClick={() => startEdit(r)} className="rounded-md border border-border/60 p-1 hover:text-primary">
                      <Edit className="h-3 w-3" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => setConfirmDel(r.id)} className="rounded-md border border-destructive/40 p-1 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {openForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpenForm(false)}>
          <div className="glass-panel w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold">{editing ? "Edit feedback" : "Add feedback"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Overall rating</label>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)}>
                      <Star className={`h-6 w-6 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Comments</label>
                  <button type="button" onClick={() => setComments((c) => [...c, ""])}
                    className="flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                    <Plus className="h-3 w-3" /> Add line
                  </button>
                </div>
                <div className="mt-1 space-y-1.5">
                  {comments.map((c, i) => (
                    <div key={i} className="flex gap-1.5">
                      <textarea value={c} rows={2}
                        onChange={(e) => setComments((arr) => arr.map((x, j) => j === i ? e.target.value : x))}
                        placeholder={`Comment line ${i + 1}`}
                        className="flex-1 rounded-lg border border-border/60 bg-card/60 px-2 py-1.5 text-sm" />
                      {comments.length > 1 && (
                        <button type="button" onClick={() => setComments((arr) => arr.filter((_, j) => j !== i))}
                          className="rounded-md border border-destructive/40 px-2 text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {products.length > 0 && (
                <div>
                  <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Product ratings</label>
                  <p className="text-[10px] text-muted-foreground">Assign a rating to individual products from this order.</p>
                  <div className="mt-1.5 space-y-1.5">
                    {products.map((p) => {
                      const pr = productRatings.find((x) => x.product_id === p.id);
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-2 py-1.5">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium">{p.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground">{p.sku}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button key={n} type="button" onClick={() => setProductRating(p.id, n)}>
                                <Star className={`h-4 w-4 ${pr && n <= pr.rating ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
                              </button>
                            ))}
                            {pr && (
                              <button type="button" onClick={() => removeProductRating(p.id)}
                                className="ml-1 text-muted-foreground hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as "open" | "resolved")}
                  className="mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm">
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setOpenForm(false)} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs">Cancel</button>
                <button onClick={submit} className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Delete feedback?"
        description="This cannot be undone."
        variant="destructive"
        onConfirm={async () => { if (confirmDel) await del.mutateAsync(confirmDel); setConfirmDel(null); }}
      />
    </Panel>
  );
}

function StarRow({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${cls} ${i < value ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
      ))}
    </div>
  );
}
