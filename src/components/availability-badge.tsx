import type { Availability } from "@/lib/inventory-db";

export function AvailabilityBadge({ a, full }: { a: Availability; full?: boolean }) {
  const color = a.status === "available" ? "text-success" : a.status === "atp" ? "text-warning" : "text-destructive";
  const label = a.status === "available" ? "In stock" : a.status === "atp" ? "Available with incoming supply" : "Short";
  return (
    <div className={`flex flex-wrap gap-4 text-xs ${full ? "" : "text-[11px]"}`}>
      <span className={`font-semibold ${color}`}>{label}</span>
      <span>Available now: <b className="font-mono">{Number(a.available).toLocaleString()}</b></span>
      <span>Incoming: <b className="font-mono">{Number(a.incoming).toLocaleString()}</b></span>
      <span>ATP: <b className="font-mono">{Number(a.atp).toLocaleString()}</b></span>
      {a.supply_date && <span>Next supply: <b>{a.supply_date}</b></span>}
    </div>
  );
}
