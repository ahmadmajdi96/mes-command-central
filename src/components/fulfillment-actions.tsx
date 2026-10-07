import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FUL_NEXT, useSetFulfillmentStatus, type Fulfillment } from "@/lib/fulfillment-db";

const inp = "h-8 rounded-md border border-border/60 bg-card/60 px-2 text-xs";

/** Next-step buttons for one fulfillment; shipping asks for carrier/tracking, failing asks for a reason. */
export function FulfillmentActions({ f }: { f: Fulfillment }) {
  const set = useSetFulfillmentStatus();
  const [mode, setMode] = useState<"" | "shipped" | "failed" | "scan">("");
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
  if (mode === "scan") return <ScanPack f={f} onDone={() => setMode("")} />;
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
      {(f.status === "pending" || f.status === "picking") && next.includes(f.status === "pending" ? "picking" : "packed") && (
        <button className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary" onClick={() => setMode("scan")}>Scan</button>
      )}
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

/** Barcode pick/pack: scan (or type) each item's SKU; when every unit is matched the fulfillment moves to Packed. */
function ScanPack({ f, onDone }: { f: Fulfillment; onDone: () => void }) {
  const set = useSetFulfillmentStatus();
  const [lines, setLines] = useState<Array<{ sku: string; name: string; qty: number; got: number }> | null>(null);
  const [code, setCode] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    (supabase.from("fulfillment_lines" as never) as any).select("qty, product:products(sku, name)").eq("fulfillment_id", f.id).then(({ data, error }: any) => {
      if (error) { toast.error(error.message); onDone(); return; }
      const m = new Map<string, { sku: string; name: string; qty: number; got: number }>();
      for (const l of data ?? []) { const k = String(l.product?.sku ?? "").toUpperCase(); const cur = m.get(k) ?? { sku: k, name: l.product?.name ?? "", qty: 0, got: 0 }; cur.qty += Number(l.qty); m.set(k, cur); }
      setLines([...m.values()]); setTimeout(() => ref.current?.focus(), 50);
    });
  }, [f.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (lines === null) {
    return <span className="text-[11px] text-muted-foreground">Loading items…</span>;
  }
  const total = lines.reduce((a, l) => a + l.qty, 0), got = lines.reduce((a, l) => a + l.got, 0);
  const done = total > 0 && got >= total;
  const scan = () => {
    const k = code.trim().toUpperCase(); setCode(""); if (!k) return;
    const i = lines.findIndex((l) => l.sku === k);
    if (i < 0) { toast.error(`${k} is not in this fulfillment`); return; }
    if (lines[i].got >= lines[i].qty) { toast.warning(`All ${lines[i].qty} of ${k} already scanned`); return; }
    setLines(lines.map((l, j) => (j === i ? { ...l, got: l.got + 1 } : l)));
  };
  return (
    <div className="flex w-72 flex-col gap-1.5 text-left">
      <input ref={ref} className={`${inp} w-full font-mono`} placeholder="Scan or type SKU, then Enter" value={code}
        onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scan(); } }} />
      {lines.map((l) => (
        <div key={l.sku} className={`flex justify-between text-[11px] ${l.got >= l.qty ? "text-success" : ""}`}><span className="font-mono">{l.sku}</span><span>{l.got}/{l.qty}</span></div>
      ))}
      <div className="flex items-center gap-2">
        <button className="rounded-md bg-primary px-2 py-1 text-[11px] text-primary-foreground disabled:opacity-50" disabled={!done || set.isPending}
          onClick={async () => {
            try {
              if (f.status === "pending") await set.mutateAsync({ id: f.id, status: "picking" });
              await set.mutateAsync({ id: f.id, status: "packed", notes: `Scan-verified ${got} unit(s)` });
              onDone();
            } catch { /* toast shown by hook */ }
          }}>Mark packed ({got}/{total})</button>
        <button className="text-[11px] text-muted-foreground" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}
