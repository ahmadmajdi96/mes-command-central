import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EXC_SEVERITIES, EXC_STATUSES, EXC_TYPES, useAddComment, useExceptionComments, usePeople, useSaveException, type OrderException } from "@/lib/exceptions-db";

const inp = "h-9 w-full rounded-md border border-border/60 bg-card/60 px-2 text-sm";
const nice = (s: string) => s.replace(/_/g, " ");

/** Create or edit an exception, with comment thread when editing. */
export function ExceptionEditor({ open, onOpenChange, initial, orders }: {
  open: boolean; onOpenChange: (v: boolean) => void; initial?: Partial<OrderException> | null;
  orders: { id: string; number: string }[];
}) {
  const [v, setV] = useState<Partial<OrderException>>({});
  const [comment, setComment] = useState("");
  const save = useSaveException(); const add = useAddComment();
  const { data: people = [] } = usePeople();
  const { data: comments = [] } = useExceptionComments(initial?.id ?? null);
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = `${open}-${initial?.id ?? "new"}`;
  if (open && seeded !== key) { setSeeded(key); setV({ type: "other", severity: "medium", status: "open", ...initial }); setComment(""); }
  const set = (k: keyof OrderException, val: unknown) => setV((s) => ({ ...s, [k]: val }));
  const needsResolution = v.status === "resolved" || v.status === "closed";

  const submit = () => {
    if (!v.title?.trim()) return;
    if (needsResolution && !v.resolution?.trim()) return;
    const { id, number: _n, created_at: _c, updated_at: _u, ...rest } = v as OrderException;
    save.mutate({ ...(id ? { id } : {}), ...rest, owner_id: rest.owner_id || null, order_id: rest.order_id || null, due_at: rest.due_at || undefined } as Partial<OrderException>, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{initial?.id ? `Exception ${initial.number}` : "New exception"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs">Title *<input className={inp} value={v.title ?? ""} onChange={(e) => set("title", e.target.value)} /></label>
          <label className="text-xs">Order<select className={inp} value={v.order_id ?? ""} onChange={(e) => set("order_id", e.target.value)}>
            <option value="">— none —</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}</select></label>
          <label className="text-xs">Type<select className={inp} value={v.type} onChange={(e) => set("type", e.target.value)}>{EXC_TYPES.map((x) => <option key={x} value={x}>{nice(x)}</option>)}</select></label>
          <label className="text-xs">Severity<select className={inp} value={v.severity} onChange={(e) => set("severity", e.target.value)}>{EXC_SEVERITIES.map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="text-xs">Status<select className={inp} value={v.status} onChange={(e) => set("status", e.target.value)}>{EXC_STATUSES.map((x) => <option key={x} value={x}>{nice(x)}</option>)}</select></label>
          <label className="text-xs">Owner<select className={inp} value={v.owner_id ?? ""} onChange={(e) => set("owner_id", e.target.value)}>
            <option value="">Unassigned</option>{people.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.email}</option>)}</select></label>
          <label className="text-xs">Due (escalates after)<input type="datetime-local" className={inp} value={v.due_at ? v.due_at.slice(0, 16) : ""} onChange={(e) => set("due_at", e.target.value ? new Date(e.target.value).toISOString() : undefined)} /></label>
          <label className="sm:col-span-2 text-xs">Description<textarea rows={3} className={`${inp} h-auto py-1.5`} value={v.description ?? ""} onChange={(e) => set("description", e.target.value)} /></label>
          <label className="sm:col-span-2 text-xs">Resolution {needsResolution && "*"}<textarea rows={2} className={`${inp} h-auto py-1.5`} value={v.resolution ?? ""} onChange={(e) => set("resolution", e.target.value)} /></label>
        </div>
        {needsResolution && !v.resolution?.trim() && <p className="text-xs text-destructive">Describe the resolution before resolving or closing.</p>}
        <div className="flex justify-end gap-2">
          <button className="rounded-md border border-border/60 px-3 py-1.5 text-xs" onClick={() => onOpenChange(false)}>Cancel</button>
          <button className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50" disabled={!v.title?.trim() || (needsResolution && !v.resolution?.trim()) || save.isPending} onClick={submit}>Save</button>
        </div>
        {initial?.id && (
          <div className="mt-2 border-t border-border/60 pt-3">
            <h4 className="mb-2 text-xs font-semibold">Comments</h4>
            <div className="flex gap-2">
              <input className={inp} placeholder="Add a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button className="rounded-md border border-primary/40 bg-primary/10 px-3 text-xs text-primary disabled:opacity-50" disabled={!comment.trim()}
                onClick={() => add.mutate({ exception_id: initial.id!, body: comment.trim() }, { onSuccess: () => setComment("") })}>Post</button>
            </div>
            <ul className="mt-2 space-y-1.5 text-xs">
              {comments.map((c) => <li key={c.id} className="rounded-md bg-card/60 p-2"><div className="whitespace-pre-wrap">{c.body}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}{c.author_id ? ` · ${people.find((p) => p.id === c.author_id)?.email ?? "user"}` : " · system"}</div></li>)}
              {comments.length === 0 && <li className="text-muted-foreground">No comments yet.</li>}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
