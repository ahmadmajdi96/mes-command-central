import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

export const SYSTEMS = ["erp", "wms", "fulfillment", "channel", "aps", "qms"] as const;
export const OWN_SYSTEM = "mes-command-central";
export const SCHEMA_VERSION = "1.0";

/** Shared event envelope (see report: event_id, correlation_id, source_system, entity_revision, occurred_at, schema_version, idempotency_key). */
export const Envelope = z.object({
  event_id: z.string().max(200).optional(),
  message_id: z.string().max(200).optional(),
  correlation_id: z.string().max(200).optional(),
  source_system: z.string().max(64).optional(),
  entity_id: z.string().max(200).optional(),
  entity_revision: z.number().int().nonnegative().optional(),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  schema_version: z.string().max(16).optional(),
  idempotency_key: z.string().max(300).optional(),
}).passthrough();
export type EnvelopeT = z.infer<typeof Envelope>;

/** Body APS's /api/public/integrations/oms endpoint accepts. */
export function apsRecord(payload: any) {
  return {
    po_number: String(payload.po_number), sku: String(payload.sku), quantity: Number(payload.quantity),
    due_date: String(payload.due_date), priority: Math.min(9, Math.max(1, Math.round(Number(payload.priority ?? 3)))),
    status: String(payload.status ?? "released"),
  };
}
export type HubSystem = (typeof SYSTEMS)[number];
const MAX_ATTEMPTS = 5;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export function sign(body: string, secret: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}
export function verifySignature(body: string, header: string | null, secret: string) {
  if (!header) return false;
  const exp = Buffer.from(sign(body, secret));
  const got = Buffer.from(header.startsWith("sha256=") ? header : "sha256=" + header);
  return exp.length === got.length && timingSafeEqual(exp, got);
}

/* ------------------------------ Inbound ------------------------------ */
const Line = z.object({ sku: z.string().min(1).max(64), qty: z.number().positive(), unit_price: z.number().nonnegative().optional() });
export const InboundSchemas = {
  "order.create": z.object({
    external_id: z.string().max(128).optional(), channel: z.string().max(32).optional(), due_date: z.string().max(10).optional(), notes: z.string().max(2000).optional(),
    customer: z.object({ name: z.string().min(1).max(200), email: z.string().email().max(255).optional(), phone: z.string().max(50).optional() }),
    lines: z.array(Line).min(1).max(500),
  }),
  "order.status": z.object({ order_number: z.string().min(1).max(64), status: z.string().min(1).max(32) }),
  "order.cancel": z.object({ order_number: z.string().min(1).max(64), reason: z.string().max(500).optional() }),
  "shipment.confirm": z.object({ fulfillment_number: z.string().min(1).max(64), carrier: z.string().max(64).optional(), tracking: z.string().max(128).optional() }),
  "fulfillment.status": z.object({ fulfillment_number: z.string().min(1).max(64), status: z.enum(["picking", "packed", "shipped", "delivered", "failed", "cancelled"]), reason: z.string().max(500).optional(), carrier: z.string().max(64).optional(), tracking: z.string().max(128).optional() }),
  "inventory.adjust": z.object({ sku: z.string().min(1).max(64), location_code: z.string().min(1).max(64), type: z.enum(["receipt", "issue", "adjustment"]), qty: z.number(), reference: z.string().max(128).optional() }),
  "schedule.approved": z.object({
    schedule_version: z.string().min(1).max(80), approved_at: z.string().datetime({ offset: true }).optional(),
    items: z.array(z.object({
      po_number: z.string().min(1).max(64), machine: z.string().max(80).optional(), sequence: z.number().int().nonnegative().optional(),
      planned_start: z.string().datetime({ offset: true }), planned_end: z.string().datetime({ offset: true }),
      plan_revision: z.number().int().positive().optional(), feasibility: z.string().max(40).optional(),
    })).min(1).max(1000),
  }),
  "qc.disposition": z.object({
    batch_number: z.string().max(64).optional(), lot_code: z.string().max(64).optional(),
    result: z.enum(["hold", "release", "reject"]), reason: z.string().min(1).max(1000),
    ncr: z.object({ external_id: z.string().max(80).optional(), title: z.string().min(1).max(200), severity: z.enum(["minor", "major", "critical"]).default("minor"),
      disposition: z.enum(["use_as_is", "rework", "scrap", "return_to_supplier"]).optional(), qty_affected: z.number().nonnegative().optional() }).optional(),
  }).refine((p) => p.batch_number || p.lot_code, { message: "batch_number or lot_code is required" }),
} as const;
export type InboundType = keyof typeof InboundSchemas;
export const isInboundType = (t: string): t is InboundType => t in InboundSchemas;

const fail = (m: string) => { throw new Error(m); };

async function processMessage(type: InboundType, raw: unknown): Promise<Record<string, unknown>> {
  const db = await admin();
  const p: any = InboundSchemas[type].parse(raw);
  const rpc = async (fn: string, args: Record<string, unknown>) => { const { error } = await db.rpc(fn, args); if (error) fail(error.message); };

  if (type === "order.create") {
    let cust: any = null;
    if (p.customer.email) cust = (await db.from("customers").select("id").eq("email", p.customer.email).maybeSingle()).data;
    if (!cust) cust = (await db.from("customers").select("id").eq("name", p.customer.name).maybeSingle()).data;
    if (!cust) {
      const r = await db.from("customers").insert({ name: p.customer.name, email: p.customer.email ?? null, phone: p.customer.phone ?? null }).select("id").single();
      if (r.error) fail(r.error.message); cust = r.data;
    }
    const skus = [...new Set(p.lines.map((l: any) => l.sku))];
    const { data: prods } = await db.from("products").select("id, sku, sale_price").in("sku", skus);
    const missing = skus.filter((s) => !(prods ?? []).some((x: any) => x.sku === s));
    if (missing.length) fail(`Unknown SKU(s): ${missing.join(", ")}`);
    const lines = p.lines.map((l: any) => { const pr = prods.find((x: any) => x.sku === l.sku); return { product_id: pr.id, qty: l.qty, unit_price: l.unit_price ?? Number(pr.sale_price ?? 0), due_date: p.due_date ?? null }; });
    const total = lines.reduce((s: number, l: any) => s + l.qty * l.unit_price, 0);
    const o = await db.from("sales_orders").insert({
      customer_id: cust.id, status: "confirmed", order_date: new Date().toISOString().slice(0, 10), due_date: p.due_date ?? null,
      total, channel: p.channel ?? "api", notes: [p.external_id ? `External ref ${p.external_id}` : null, p.notes].filter(Boolean).join(" · ") || null,
    }).select("id, number").single();
    if (o.error) fail(o.error.message);
    const li = await db.from("sales_order_lines").insert(lines.map((l: any) => ({ ...l, order_id: o.data.id })));
    if (li.error) { await db.from("sales_orders").delete().eq("id", o.data.id); fail(li.error.message); }
    return { order_id: o.data.id, order_number: o.data.number, entity_table: "sales_orders", entity_id: o.data.id };
  }
  if (type === "order.status" || type === "order.cancel") {
    const { data: o } = await db.from("sales_orders").select("id").eq("number", p.order_number).maybeSingle();
    if (!o) fail(`Order ${p.order_number} not found`);
    const r = await db.from("sales_orders").update({ status: type === "order.cancel" ? "cancelled" : p.status, ...(p.reason ? { hold_reason: p.reason } : {}) }).eq("id", o.id);
    if (r.error) fail(r.error.message);
    return { order_number: p.order_number, entity_table: "sales_orders", entity_id: o.id };
  }
  if (type === "shipment.confirm" || type === "fulfillment.status") {
    const { data: f } = await db.from("fulfillments").select("id").eq("number", p.fulfillment_number).maybeSingle();
    if (!f) fail(`Fulfillment ${p.fulfillment_number} not found`);
    await rpc("set_fulfillment_status", { _id: f.id, _status: type === "shipment.confirm" ? "shipped" : p.status, _carrier: p.carrier ?? null, _tracking: p.tracking ?? null, _notes: p.reason ?? null });
    return { fulfillment_number: p.fulfillment_number, entity_table: "fulfillments", entity_id: f.id };
  }
  if (type === "schedule.approved") {
    const nums = p.items.map((i: any) => i.po_number);
    const { data: pos } = await db.from("production_orders").select("id, number, status, revision, planning_status").in("number", nums);
    const missing = nums.filter((n: string) => !(pos ?? []).some((x: any) => x.number === n));
    if (missing.length) fail(`Unknown production order(s): ${missing.join(", ")}`);
    const stale: string[] = [];
    for (const it of p.items) {
      const po = pos.find((x: any) => x.number === it.po_number);
      if (it.plan_revision && it.plan_revision !== po.revision) stale.push(it.po_number);
      // APS owns only placement; order status and quantity stay here.
      const upd: Record<string, unknown> = {
        aps_schedule_version: p.schedule_version, aps_machine: it.machine ?? null, aps_sequence: it.sequence ?? null,
        aps_planned_start: it.planned_start, aps_planned_end: it.planned_end, aps_plan_revision: it.plan_revision ?? po.revision,
        aps_approved_at: p.approved_at ?? new Date().toISOString(), aps_feasibility: it.feasibility ?? null,
      };
      if (po.planning_status === "released" || po.planning_status === "unplanned") upd.planning_status = po.status === "released" ? "planned" : po.planning_status;
      const r = await db.from("production_orders").update(upd).eq("id", po.id);
      if (r.error) fail(r.error.message);
    }
    return { schedule_version: p.schedule_version, orders: p.items.length, stale_plans: stale, entity_table: "production_orders" };
  }
  if (type === "qc.disposition") {
    let q = db.from("batches").select("id, number, production_order_id, product_id, lot_code");
    q = p.batch_number ? q.eq("number", p.batch_number) : q.eq("lot_code", p.lot_code);
    const { data: b } = await q.maybeSingle();
    if (!b) fail(`Batch ${p.batch_number ?? p.lot_code} not found`);
    let holdId: string | null = null;
    if (p.result === "hold" || p.result === "reject") {
      const { data: active } = await db.from("quality_holds").select("id").eq("batch_id", b.id).eq("status", "active").maybeSingle();
      if (active) holdId = active.id;
      else {
        const h = await db.from("quality_holds").insert({ batch_id: b.id, reason: p.reason, source: "qc", created_by: null }).select("id").single();
        if (h.error) fail(h.error.message); holdId = h.data.id;
      }
    } else {
      const r = await db.from("quality_holds").update({ status: "released", release_reason: `QC release: ${p.reason}` }).eq("batch_id", b.id).eq("status", "active");
      if (r.error) fail(r.error.message);
    }
    let ncrId: string | null = null;
    if (p.ncr || p.result === "reject") {
      const n = p.ncr ?? { title: `QC rejection of ${b.number}`, severity: "major" };
      const row = { title: n.title, description: p.reason, source: "qc", severity: n.severity ?? "major", disposition: n.disposition ?? null, qty_affected: n.qty_affected ?? null,
        batch_id: b.id, production_order_id: b.production_order_id, product_id: b.product_id, hold_id: holdId, external_id: n.external_id ?? null, created_by: null };
      const prev = n.external_id ? (await db.from("ncr_reports").select("id").eq("external_id", n.external_id).maybeSingle()).data : null;
      const r = prev
        ? await db.from("ncr_reports").update(row).eq("id", prev.id).select("id").single()
        : await db.from("ncr_reports").insert(row).select("id").single();
      if (r.error) fail(r.error.message); ncrId = r.data.id;
    }
    return { batch: b.number, result: p.result, hold_id: holdId, ncr_id: ncrId, entity_table: "batches", entity_id: b.id };
  }
  // inventory.adjust
  const [{ data: pr }, { data: loc }] = await Promise.all([
    db.from("products").select("id").eq("sku", p.sku).maybeSingle(),
    db.from("locations").select("id").eq("code", p.location_code).maybeSingle(),
  ]);
  if (!pr) fail(`Unknown SKU ${p.sku}`);
  if (!loc) fail(`Unknown location ${p.location_code}`);
  await rpc("inv_move", { _product: pr.id, _location: loc.id, _type: p.type, _qty: p.qty, _to_location: null, _reference: p.reference ?? "integration" });
  return { sku: p.sku, location_code: p.location_code, entity_table: "inventory_levels" };
}

/** Store + process one inbound message. Duplicates (same system + message id) are acknowledged, never re-applied. */
export async function receiveInbound(system: HubSystem, messageId: string, type: string, payload: unknown, signatureValid: boolean, env: EnvelopeT = {}) {
  const db = await admin();
  const idem = env.idempotency_key ?? null;
  let existing = (await db.from("integration_messages").select("id, status, response").eq("system", system).eq("direction", "inbound").eq("message_id", messageId).maybeSingle()).data;
  if (!existing && idem) existing = (await db.from("integration_messages").select("id, status, response").eq("system", system).eq("direction", "inbound").eq("idempotency_key", idem).maybeSingle()).data;
  if (existing) return { status: 200, body: { ok: true, duplicate: true, message: existing.id, previous_status: existing.status, result: existing.response } };
  const ins = await db.from("integration_messages").insert({
    message_id: messageId, system, direction: "inbound", message_type: type, status: "received", payload: payload ?? {}, signature_valid: signatureValid, attempts: 0,
    correlation_id: env.correlation_id ?? messageId, source_system: env.source_system ?? system, entity_revision: env.entity_revision ?? null,
    occurred_at: env.occurred_at ?? null, received_at: new Date().toISOString(), schema_version: env.schema_version ?? SCHEMA_VERSION, idempotency_key: idem,
  }).select("id").single();
  if (ins.error) {
    if (String(ins.error.code) === "23505") return { status: 200, body: { ok: true, duplicate: true } };
    return { status: 500, body: { ok: false, error: "Could not store message" } };
  }
  return runInbound(ins.data.id);
}

export async function runInbound(id: string) {
  const db = await admin();
  const { data: m } = await db.from("integration_messages").select("*").eq("id", id).single();
  if (!isInboundType(m.message_type)) {
    await db.from("integration_messages").update({ status: "failed", error: `Unsupported message type ${m.message_type}`, attempts: m.attempts + 1 }).eq("id", id);
    return { status: 422, body: { ok: false, message: id, error: `Unsupported message type ${m.message_type}`, supported: Object.keys(InboundSchemas) } };
  }
  try {
    const result = await processMessage(m.message_type, m.payload);
    const { entity_table, entity_id, ...rest } = result as any;
    await db.from("integration_messages").update({ status: "processed", outcome: "processed", error: null, response: rest, entity_table: entity_table ?? null, entity_id: entity_id ?? null, processed_at: new Date().toISOString(), attempts: m.attempts + 1 }).eq("id", id);
    return { status: 200, body: { ok: true, message: id, result: rest } };
  } catch (e) {
    const msg = e instanceof z.ZodError ? "Invalid payload: " + e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") : e instanceof Error ? e.message : String(e);
    await db.from("integration_messages").update({ status: "failed", outcome: "failed", error: msg, attempts: m.attempts + 1 }).eq("id", id);
    return { status: e instanceof z.ZodError ? 400 : 422, body: { ok: false, message: id, error: msg } };
  }
}

/* ------------------------------ Outbound ----------------------------- */
async function sendOne(m: any, ep: any, secret: string) {
  const db = await admin();
  if (!ep?.url || !ep.enabled) {
    await db.from("integration_messages").update({ status: "held", error: "Endpoint has no address or is turned off" }).eq("id", m.id);
    return false;
  }
  const envelope = {
    event_id: m.message_id, message_id: m.message_id, correlation_id: m.correlation_id ?? null, source_system: OWN_SYSTEM,
    entity_id: m.entity_id ?? null, entity_revision: m.entity_revision ?? null, occurred_at: m.occurred_at ?? m.created_at,
    schema_version: m.schema_version ?? SCHEMA_VERSION, idempotency_key: m.idempotency_key ?? m.message_id,
  };
  const isAps = ep.system === "aps";
  // APS's inbound contract is { records: [...] } with an x-api-key header; everyone else gets the signed envelope.
  const body = isAps
    ? JSON.stringify({ records: [apsRecord(m.payload)], ...envelope })
    : JSON.stringify({ ...envelope, type: m.message_type, sent_at: new Date().toISOString(), payload: m.payload });
  const headers: Record<string, string> = {
    "content-type": "application/json", "x-message-id": m.message_id, "x-message-type": m.message_type,
    "x-correlation-id": String(envelope.correlation_id ?? ""), "x-idempotency-key": String(envelope.idempotency_key), "x-signature": sign(body, secret),
  };
  if (isAps) {
    const k = process.env["APS_INTEGRATION_KEY"];
    if (!k) {
      await db.from("integration_messages").update({ status: "held", error: "APS integration key is not set" }).eq("id", m.id);
      return false;
    }
    headers["x-api-key"] = k;
  }
  const attempts = m.attempts + 1;
  try {
    const res = await fetch(ep.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10000) });
    const text = (await res.text()).slice(0, 2000);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${text.slice(0, 200)}`);
    let parsed: unknown = text; try { parsed = JSON.parse(text); } catch { /* keep text */ }
    await db.from("integration_messages").update({ status: "sent", outcome: "delivered", attempts, error: null, response: { http: res.status, body: parsed }, processed_at: new Date().toISOString(), next_retry_at: null }).eq("id", m.id);
    return true;
  } catch (e) {
    const dead = attempts >= MAX_ATTEMPTS;
    await db.from("integration_messages").update({
      status: dead ? "dead" : "failed", attempts, error: e instanceof Error ? e.message : String(e),
      next_retry_at: dead ? null : new Date(Date.now() + 2 ** attempts * 60_000).toISOString(),
    }).eq("id", m.id);
    return false;
  }
}

/** Send due outbound messages (pending, or failed whose retry time has come). */
export async function dispatchDue(limit = 50) {
  const db = await admin();
  const secret = process.env.INTEGRATION_WEBHOOK_SECRET ?? "";
  const { data: due } = await db.from("integration_messages").select("*").eq("direction", "outbound").in("status", ["pending", "failed"]).or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`).order("created_at").limit(limit);
  const { data: eps } = await db.from("integration_endpoints").select("*");
  let sent = 0, failed = 0;
  for (const m of due ?? []) (await sendOne(m, (eps ?? []).find((e: any) => e.id === m.endpoint_id), secret)) ? sent++ : failed++;
  return { sent, failed, checked: (due ?? []).length };
}

/** Manual retry of one message (inbound: re-process; outbound: re-send now). */
export async function retryMessage(id: string) {
  const db = await admin();
  const { data: m } = await db.from("integration_messages").select("*").eq("id", id).single();
  if (!m) throw new Error("Message not found");
  if (m.direction === "inbound") {
    if (m.status === "processed") throw new Error("Already processed — retrying would apply it twice");
    const r = await runInbound(id);
    return { ok: r.body.ok, error: (r.body as any).error };
  }
  if (m.status === "sent") throw new Error("Already delivered");
  const { data: ep } = await db.from("integration_endpoints").select("*").eq("id", m.endpoint_id).maybeSingle();
  const ok = await sendOne({ ...m, attempts: m.status === "dead" ? 0 : m.attempts }, ep, process.env.INTEGRATION_WEBHOOK_SECRET ?? "");
  const { data: after } = await db.from("integration_messages").select("error").eq("id", id).single();
  return { ok, error: ok ? undefined : after?.error };
}

/** Periodic housekeeping: outbound delivery + exception escalation + alert rules. */
export async function runScheduled() {
  const db = await admin();
  const sweep = await db.rpc("sweep_exceptions");
  const dispatch = await dispatchDue();
  const esc = await db.rpc("escalate_exceptions");
  const alerts = await db.rpc("run_alert_rules");
  await db.rpc("expire_reservations");
  return { dispatch, queued: sweep.data?.created ?? 0, auto_resolved: sweep.data?.auto_resolved ?? 0, escalated: esc.data ?? 0, alerts_fired: alerts.data ?? 0 };
}
