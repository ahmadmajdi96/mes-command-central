import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret",
} as const;

const Schema = z.object({
  event_type: z.literal("kpi.snapshot"),
  metric: z.string().min(1).max(128),
  value: z.number(),
  unit: z.string().max(32).optional(),
  captured_at: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const Route = createFileRoute("/api/public/webhooks/command-center")({
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
          await supabaseAdmin.from("kpi_snapshots").insert({
            source: "command_center",
            metric: e.metric,
            value: e.value,
            unit: e.unit ?? null,
            captured_at: e.captured_at ?? new Date().toISOString(),
            metadata: (e.metadata ?? null) as never,
          });
          await supabaseAdmin.from("integration_events").insert({
            source: "command_center", direction: "inbound", event_type: e.event_type, status: "ok", payload: e as never,
          });
        } catch (err) {
          await supabaseAdmin.from("integration_events").insert({
            source: "command_center", direction: "inbound", event_type: e.event_type, status: "error",
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
