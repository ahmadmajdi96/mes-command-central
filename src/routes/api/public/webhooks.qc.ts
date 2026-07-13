import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret",
} as const;

const Schema = z.object({
  event_type: z.enum([
    "inspection.created", "inspection.updated",
    "ncr.raised", "ncr.updated", "ncr.closed",
    "request.acknowledged", "request.in_review", "request.approved", "request.rejected", "request.completed", "request.failed",
  ]),
  external_id: z.string().max(128).optional(),
  // Correlation to OMS product_requests
  request_id: z.string().uuid().optional(),
  request_number: z.string().max(64).optional(),
  from_status: z.string().max(32).optional(),
  to_status: z.string().max(32).optional(),
  actor: z.string().max(128).optional(),
  work_order_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  inspection_type: z.string().max(64).optional(),
  status: z.string().max(32).optional(),
  inspector: z.string().max(128).optional(),
  sample_size: z.number().int().min(0).optional(),
  defects_found: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  inspected_at: z.string().datetime().optional(),
  number: z.string().max(64).optional(),
  severity: z.enum(["minor","major","critical"]).optional(),
  description: z.string().max(2000).optional(),
  disposition: z.string().max(500).optional(),
  raised_by: z.string().max(128).optional(),
  raised_at: z.string().datetime().optional(),
  closed_at: z.string().datetime().optional(),
});


export const Route = createFileRoute("/api/public/webhooks/qc")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const secret = process.env.INTEGRATION_WEBHOOK_SECRET;
        if (secret && request.headers.get("x-webhook-secret") !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        let body: unknown;
        try { body = await request.json(); } catch { body = null; }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid payload", issues: parsed.error.issues }), {
            status: 400, headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const e = parsed.data;

        try {
          if (e.event_type.startsWith("request.")) {
            // Resolve target OMS request by id or number
            let requestId: string | null = e.request_id ?? null;
            let fromStatus: string | null = e.from_status ?? null;
            if (!requestId && e.request_number) {
              const { data: r } = await supabaseAdmin
                .from("product_requests")
                .select("id,status")
                .eq("number", e.request_number)
                .maybeSingle();
              if (r) { requestId = r.id; fromStatus = fromStatus ?? (r.status as string); }
            } else if (requestId && !fromStatus) {
              const { data: r } = await supabaseAdmin
                .from("product_requests")
                .select("status")
                .eq("id", requestId)
                .maybeSingle();
              fromStatus = (r?.status as string) ?? null;
            }

            if (!requestId) {
              throw new Error("request_id or request_number required for request.* events");
            }

            const toStatus = e.to_status ?? e.event_type.replace("request.", "");
            const validStatuses = new Set(["pending","in_review","approved","rejected","completed","cancelled","failed","acknowledged"]);
            const statusPatch: Record<string, unknown> = {};
            if (validStatuses.has(toStatus)) statusPatch.status = toStatus;
            if (e.event_type === "request.completed") statusPatch.delivery_status = "delivered";
            if (e.event_type === "request.failed") { statusPatch.delivery_status = "failed"; statusPatch.delivery_error = e.notes ?? "Reported by QC"; }

            if (Object.keys(statusPatch).length > 0) {
              await supabaseAdmin.from("product_requests").update(statusPatch as never).eq("id", requestId);
            }

            await supabaseAdmin.from("request_events").insert({
              request_id: requestId,
              event_type: e.event_type,
              from_status: fromStatus,
              to_status: toStatus,
              notes: e.notes ?? null,
              payload: e as never,
            } as never);
          } else if (e.event_type.startsWith("inspection.")) {
            await supabaseAdmin.from("qc_inspections").upsert({
              external_id: e.external_id ?? null,
              work_order_id: e.work_order_id ?? null,
              product_id: e.product_id ?? null,
              inspection_type: e.inspection_type ?? "in_process",
              status: e.status ?? "pending",
              inspector: e.inspector ?? null,
              sample_size: e.sample_size ?? 1,
              defects_found: e.defects_found ?? 0,
              notes: e.notes ?? null,
              inspected_at: e.inspected_at ?? null,
            } as never, { onConflict: "external_id" });
          } else {
            await supabaseAdmin.from("non_conformances").upsert({
              external_id: e.external_id ?? null,
              number: e.number ?? `NCR-${Date.now()}`,
              work_order_id: e.work_order_id ?? null,
              product_id: e.product_id ?? null,
              severity: e.severity ?? "minor",
              status: e.event_type === "ncr.closed" ? "closed" : (e.status as never) ?? "open",
              description: e.description ?? null,
              disposition: e.disposition ?? null,
              raised_by: e.raised_by ?? null,
              raised_at: e.raised_at ?? new Date().toISOString(),
              closed_at: e.closed_at ?? null,
            } as never, { onConflict: "external_id" });
          }

          await supabaseAdmin.from("integration_events").insert({
            source: "qc", direction: "inbound", event_type: e.event_type, status: "ok", payload: e as never,
          });
        } catch (err) {
          await supabaseAdmin.from("integration_events").insert({
            source: "qc", direction: "inbound", event_type: e.event_type, status: "error",
            payload: e as never, error: err instanceof Error ? err.message : String(err),
          });

          return new Response(JSON.stringify({ error: "Persist failed" }), {
            status: 500, headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
