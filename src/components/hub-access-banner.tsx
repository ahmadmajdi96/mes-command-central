import { ShieldAlert } from "lucide-react";
import { usePermissions } from "@/lib/permissions";

/** Explains when the Command Access Hub has limited this person to view-only. */
export function HubAccessBanner() {
  const { data } = usePermissions();
  if (!data?.hub?.enforced || data.hub.status === "ok" || !data.hub.message) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{data.hub.message}</span>
    </div>
  );
}
