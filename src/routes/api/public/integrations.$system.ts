import { createFileRoute } from "@tanstack/react-router";
import { SYSTEMS, receiveInbound, verifySignature, type HubSystem } from "@/lib/integration-hub.server";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Inbound messages from ERP / WMS / fulfillment partners / sales channels.
 * POST /api/public/integrations/{erp|wms|fulfillment|channel}
 * Headers: X-Signature: sha256=<hex HMAC of raw body with the shared secret>, X-Message-Id (or body.message_id)
 * Body: { "type": "order.create" | "order.status" | "order.cancel" | "shipment.confirm" | "fulfillment.status" | "inventory.adjust", "payload": {...} }
 */
export const Route = createFileRoute("/api/public/integrations/$system")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const system = params.system as HubSystem;
        if (!SYSTEMS.includes(system)) return json(404, { ok: false, error: `Unknown system. Use one of ${SYSTEMS.join(", ")}` });
        const secret = process.env.INTEGRATION_WEBHOOK_SECRET;
        if (!secret) return json(503, { ok: false, error: "Integration secret not configured" });
        const raw = await request.text();
        if (raw.length > 1_000_000) return json(413, { ok: false, error: "Payload too large" });
        if (!verifySignature(raw, request.headers.get("x-signature"), secret)) return json(401, { ok: false, error: "Invalid signature" });
        let body: any;
        try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: "Body must be JSON" }); }
        const messageId = String(request.headers.get("x-message-id") ?? body?.message_id ?? "").slice(0, 200);
        if (!messageId) return json(400, { ok: false, error: "Missing message id (X-Message-Id header or message_id field)" });
        if (typeof body?.type !== "string") return json(400, { ok: false, error: "Missing type" });
        const r = await receiveInbound(system, messageId, body.type, body.payload ?? {}, true);
        return json(r.status, r.body);
      },
    },
  },
});
