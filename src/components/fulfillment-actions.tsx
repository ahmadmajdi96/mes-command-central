import { useState } from "react";
import { FUL_NEXT, useSetFulfillmentStatus, type Fulfillment } from "@/lib/fulfillment-db";

const inp = "h-8 rounded-md border border-border/60 bg-card/60 px-2 text-xs";

/** Next-step buttons for one fulfillment; shipping asks for carrier/tracking, failing asks for a reason. */
export function FulfillmentActions({ f }: { f: Fulfillment }) {
  const set = useSetFulfillmentStatus();
  const [mode, setMode] = useState<"" | "shipped" | "failed">("");
  const [carrier, setCarrier] = useState(f.carrier ?? "");
  const [tracking, setTracking] = useState(f.tracking ?? "");
  const [reason, setReason] = useState("");
  const next = FUL_NEXT[f.status] ?? [];
  if (!next.length) return null;

  if (mode === "shipped") return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input className={`${inp} w-28`} placeholder="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
      <input className={`${inp} w-32`} placeholder="Tracking no." value={tracking} onChange={(e) => setTracking(e.target.value)} />
      <button className="rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-50" disabled={set.isPending}
        onClick={() => set.mutate({ id: f.id, status: "shipped", carrier, tracking }, { onSuccess: () => setMode("") })}>Confirm ship</button>
      <button className="text-[11px] text-muted-foreground" onClick={() => setMode("")}>Cancel</button>
    </div>
  );
  if (mode === "failed") return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input className={`${inp} w-48`} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="rounded-md bg-destructive px-2 py-1 text-[11px] text-destructive-foreground disabled:opacity-50" disabled={!reason.trim() || set.isPending}
        onClick={() => set.mutate({ id: f.id, status: "failed", notes: reason }, { onSuccess: () => setMode("") })}>Mark failed</button>
      <button className="text-[11px] text-muted-foreground" onClick={() => setMode("")}>Cancel</button>
    </div>
  );
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {next.map((s) => (
        <button key={s} disabled={set.isPending}
          className={`rounded-md border px-2 py-0.5 text-[11px] capitalize disabled:opacity-50 ${s === "failed" || s === "cancelled" ? "border-destructive/40 text-destructive" : s === "shipped" || s === "delivered" ? "border-success/40 bg-success/10 text-success" : "border-border/60 text-foreground"}`}
          onClick={() => {
            if (s === "shipped" || s === "failed") return setMode(s);
            if (s === "cancelled" && !confirm(`Cancel ${f.number}? Its stock goes back to waiting for fulfillment.`)) return;
            set.mutate({ id: f.id, status: s });
          }}>{s === "pending" ? "Retry" : s}</button>
      ))}
    </div>
  );
}
