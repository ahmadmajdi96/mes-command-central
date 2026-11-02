/** A plan is stale when APS approved it for an older revision of the production order. */
export function isPlanStale(po: { aps_schedule_version: string | null; aps_plan_revision: number | null; revision: number; status: string }) {
  if (!po.aps_schedule_version || po.aps_plan_revision == null) return false;
  if (po.status === "completed" || po.status === "cancelled") return false;
  return po.aps_plan_revision !== po.revision;
}
