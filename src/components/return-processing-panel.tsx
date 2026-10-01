import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Panel } from "@/components/page-shell";
import { useLocations } from "@/lib/inventory-db";
import { useDisposition, useReceiveReturn, useUpdateReturnShipping } from "@/lib/exceptions-db";

const sel = "h-8 rounded-md border border-border/60 bg-card/60 px-2 text-xs";
const DISPOSITIONS = [
  { v: "restock", l: "Restock (back to stock)" }, { v: "repair", l: "Repair" },
  { v: "quarantine", l: "Quarantine" }, { v: "dispose", l: "Dispose" },
];
const SHIP_STATUSES = ["awaiting", "label_sent", "in_transit", "received"];

type Ret = { id: string; status: string; destination_location_id?: string | null; return_carrier?: string | null; return_tracking?: string | null; return_shipment_status?: string; received_at?: string | null };
type Line = { id: string; product_id: string | null; qty: number; received_qty?: number; condition?: string | null; disposition?: string | null; inspection_notes?: string | null };

/** Return shipment tracking, receiving at a destination, and per-line inspection + disposition. */
export function ReturnProcessingPanel({ ret, lines, productName }: { ret: Ret; lines: Line[]; productName: (id: string | null) => string }) {
  const qc = useQueryClient();
  const { data: locs = [] } = useLocations();
  const receive = useReceiveReturn(); const ship = useUpdateReturnShipping();
  const [loc, setLoc] = useState(ret.destination_location_id ?? "");
  const [carrier, setCarrier] = useState(ret.return_carrier ?? "");
  const [tracking, setTracking] = useState(ret.return_tracking ?? "");
  const [shipStatus, setShipStatus] = useState(ret.return_shipment_status ?? "awaiting");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["return", ret.id] }); qc.invalidateQueries({ queryKey: ["return_lines", ret.id] }); };
  const canProcess = ["approved", "refunded", "closed"].includes(ret.status);
  const destName = locs.find((l) => l.id === ret.destination_location_id)?.code;

  return (
    <Panel>
      <h3 className="mb-3 text-sm font-semibold">Receiving, inspection & disposition</h3>
      {!canProcess && <p className="mb-3 text-xs text-muted-foreground">Approve the return to start receiving it.</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border/60 p-3">
          <div className="mb-2 text-xs font-medium">Return shipment</div>
          <div className="flex flex-wrap gap-2">
            <input className={`${sel} w-28`} placeholder="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
            <input className={`${sel} w-36`} placeholder="Tracking no." value={tracking} onChange={(e) => setTracking(e.target.value)} />
            <select className={sel} value={shipStatus} onChange={(e) => setShipStatus(e.target.value)}>{SHIP_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
            <button className="rounded-md border border-border/60 px-2 text-xs" onClick={() => ship.mutate({ id: ret.id, return_carrier: carrier, return_tracking: tracking, return_shipment_status: shipStatus }, { onSuccess: refresh })}>Save</button>
          </div>
        </div>
        <div className="rounded-lg border border-border/60 p-3">
          <div className="mb-2 text-xs font-medium">Receive at</div>
          {ret.received_at ? (
            <p className="text-xs">Received at <b>{destName ?? "—"}</b> on {new Date(ret.received_at).toLocaleString()}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <select className={sel} value={loc} onChange={(e) => setLoc(e.target.value)}>
                <option value="">Choose destination…</option>
                {locs.filter((l) => l.active).map((l) => <option key={l.id} value={l.id}>{l.code} · {l.name} ({l.type})</option>)}
              </select>
              <button disabled={!loc || !canProcess || lines.length === 0} className="rounded-md bg-primary px-2 text-xs text-primary-foreground disabled:opacity-50"
                onClick={() => receive.mutate({ id: ret.id, location: loc }, { onSuccess: refresh })}>Mark received</button>
              {lines.length === 0 && <span className="text-[11px] text-muted-foreground">Add return lines first.</span>}
            </div>
          )}
        </div>
      </div>
      {ret.received_at && (
        <div className="mt-3 space-y-2">
          {lines.map((l) => <LineInspect key={l.id} line={l} name={productName(l.product_id)} onDone={refresh} />)}
        </div>
      )}
    </Panel>
  );
}

function LineInspect({ line, name, onDone }: { line: Line; name: string; onDone: () => void }) {
  const disp = useDisposition();
  const [d, setD] = useState("restock"); const [cond, setCond] = useState("good"); const [notes, setNotes] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-2 text-xs">
      <span className="min-w-40 font-medium">{name} × {Number(line.received_qty ?? line.qty)}</span>
      {line.disposition ? (
        <span className="text-muted-foreground">Condition <b className="text-foreground">{line.condition ?? "—"}</b> · decision <b className="capitalize text-foreground">{line.disposition}</b>{line.inspection_notes ? ` · ${line.inspection_notes}` : ""}</span>
      ) : (<>
        <select className={sel} value={cond} onChange={(e) => setCond(e.target.value)}>{["good", "opened", "damaged", "defective"].map((c) => <option key={c}>{c}</option>)}</select>
        <select className={sel} value={d} onChange={(e) => setD(e.target.value)}>{DISPOSITIONS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select>
        <input className={`${sel} flex-1`} placeholder="Inspection notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-primary" disabled={disp.isPending}
          onClick={() => disp.mutate({ line: line.id, disposition: d, condition: cond, notes }, { onSuccess: onDone })}>Save decision</button>
      </>)}
    </div>
  );
}
