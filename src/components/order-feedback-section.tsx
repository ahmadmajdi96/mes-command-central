import { useState } from "react";
import { Star, Plus, Edit, Trash2, MessageSquare, CheckCircle2 } from "lucide-react";
import { Panel } from "@/components/page-shell";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  useOrderFeedback,
  useCreateFeedback,
  useUpdateFeedback,
  useDeleteFeedback,
  type OrderFeedback,
} from "@/lib/order-feedback-db";
import { usePermission } from "@/lib/permissions";

const CATEGORIES = ["general", "quality", "delivery", "communication", "pricing"];

export function OrderFeedbackSection({ orderId }: { orderId: string }) {
  const { data: rows = [], isLoading } = useOrderFeedback(orderId);
  const create = useCreateFeedback(orderId);
  const update = useUpdateFeedback(orderId);
  const del = useDeleteFeedback(orderId);
  const canCreate = usePermission("feedback", "create");
  const canUpdate = usePermission("feedback", "update");
  const canDelete = usePermission("feedback", "delete");

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<OrderFeedback | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const [rating, setRating] = useState(5);
  const [category, setCategory] = useState("general");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"open" | "resolved">("open");

  const startCreate = () => {
    setEditing(null);
    setRating(5); setCategory("general"); setComment(""); setStatus("open");
    setOpenForm(true);
  };
  const startEdit = (r: OrderFeedback) => {
    setEditing(r);
    setRating(r.rating); setCategory(r.category); setComment(r.comment ?? ""); setStatus(r.status);
    setOpenForm(true);
  };
  const submit = async () => {
    if (editing) {
      await update.mutateAsync({ id: editing.id, patch: { rating, category, comment, status } });
    } else {
      await create.mutateAsync({ rating, category, comment, status });
    }
    setOpenForm(false);
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
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
                      ))}
                    </div>
                    <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{r.category}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${r.status === "resolved" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {r.status === "resolved" && <CheckCircle2 className="h-3 w-3" />} {r.status}
                    </span>
                  </div>
                  {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
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
          <div className="glass-panel w-full max-w-md rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold">{editing ? "Edit feedback" : "Add feedback"}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Rating</label>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)}>
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
                <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Comment</label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
                  className="mt-1 w-full rounded-lg border border-border/60 bg-card/60 px-2 py-1.5 text-sm" />
              </div>
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
        title="Delete feedback?"
        description="This cannot be undone."
        onCancel={() => setConfirmDel(null)}
        onConfirm={async () => { if (confirmDel) await del.mutateAsync(confirmDel); setConfirmDel(null); }}
      />
    </Panel>
  );
}
