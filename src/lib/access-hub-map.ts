/** Pure mapping from Command Access Hub permissions to this app's resource matrix (browser-safe, unit-tested). */
export type HubPermission = { resource_key: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean };
export type Act = "read" | "create" | "update" | "delete";
export type Matrix = Record<string, Record<Act, boolean>>;

/** Resources this app understands. Hub keys use dashes ("production-orders"); local keys use underscores. */
export const HUB_RESOURCES = [
  "orders", "customers", "products", "shipments", "production_orders", "batches", "requests", "feedback",
  "audit", "settings", "users", "roles", "inventory", "locations", "rules", "workflow", "orchestration",
  "fulfillments", "exceptions", "alerts", "kpis", "integrations", "quality_holds", "ncr", "capa",
] as const;

/** Hub feature/data keys that grant one action on a local resource. */
const FEATURE_ALIASES: Record<string, { resource: string; act: Act }> = {
  pick_fulfillment: { resource: "fulfillments", act: "update" },
  pack_fulfillment: { resource: "fulfillments", act: "update" },
  dispatch_shipment: { resource: "shipments", act: "update" },
  comment_exception: { resource: "exceptions", act: "update" },
  submit_order_feedback: { resource: "feedback", act: "create" },
  release_hold: { resource: "quality_holds", act: "update" },
};
const NAME_ALIASES: Record<string, string> = {
  nonconformance: "ncr", nonconformances: "ncr", ncrs: "ncr", capas: "capa",
  production: "production_orders", "quality_hold": "quality_holds", holds: "quality_holds",
  sales_orders: "orders", order_records: "orders",
};

export function normalizeHubKey(key: string): string {
  let k = key.trim().toLowerCase().replace(/-/g, "_").replace(/_detail$/, "").replace(/_records$/, "");
  k = NAME_ALIASES[k] ?? k;
  return k;
}

const empty = (): Record<Act, boolean> => ({ read: false, create: false, update: false, delete: false });

export function mapHubPermissions(perms: HubPermission[]): Matrix {
  const out: Matrix = {};
  const known = new Set<string>(HUB_RESOURCES);
  for (const p of perms ?? []) {
    const raw = p.resource_key.trim().toLowerCase().replace(/-/g, "_");
    const feat = FEATURE_ALIASES[raw];
    if (feat) {
      if (p.can_view || p.can_create || p.can_edit) {
        const cur = (out[feat.resource] ??= empty());
        cur[feat.act] = true; cur.read = true;
      }
      continue;
    }
    const k = normalizeHubKey(p.resource_key);
    if (!known.has(k)) continue; // unknown keys grant nothing
    const cur = (out[k] ??= empty());
    cur.read ||= !!p.can_view;
    cur.create ||= !!p.can_create;
    cur.update ||= !!p.can_edit;
    cur.delete ||= !!p.can_delete;
  }
  return out;
}

/** Fail-closed fallback: view everything, change nothing. */
export function viewOnlyMatrix(): Matrix {
  return Object.fromEntries(HUB_RESOURCES.map((r) => [r, { read: true, create: false, update: false, delete: false }]));
}
