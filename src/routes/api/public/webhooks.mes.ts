import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret",
} as const;

const EventSchema = z.object({
  event_type: z.enum(["station.heartbeat", "station.state_change", "downtime.started", "downtime.ended", "wo.progress"]),
  station_code: z.string().min(1).max(64).optional(),
  station_name: z.string().max(128).optional(),
  state: z.enum(["running","idle","down","maintenance","offline"]).optional(),
  operator: z.string().max(128).optional(),
  oee: z.number().min(0).max(100).optional(),
  work_order_id: z.string().uuid().optional(),
  workstation: z.string().max(64).optional(),
  reason: z.string().max(256).optional(),
  category: z.string().max(32).optional(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional(),
  external_id: z.string().max(128).optional(),
});

export const Route = createFileRoute("/api/public/webhooks/mes")({
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
        const parsed = EventSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid payload", issues: parsed.error.issues }), {
            status: 400, headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const e = parsed.data;

        try {
          if (e.event_type === "station.heartbeat" || e.event_type === "station.state_change") {
            if (e.station_code && e.station_name) {
              await supabaseAdmin.from("station_status").upsert({
                station_code: e.station_code,
                name: e.station_name,
                state: e.state ?? "idle",
                operator: e.operator ?? null,
                oee: e.oee ?? null,
                current_wo_id: e.work_order_id ?? null,
                last_heartbeat_at: new Date().toISOString(),
              }, { onConflict: "station_code" });
            }
          } else if (e.event_type === "downtime.started") {
            await supabaseAdmin.from("downtime_events").insert({
              external_id: e.external_id ?? null,
              work_order_id: e.work_order_id ?? null,
              workstation: e.workstation ?? e.station_code ?? null,
              reason: e.reason ?? "Unspecified",
              category: e.category ?? "unplanned",
              started_at: e.started_at ?? new Date().toISOString(),
            });
          } else if (e.event_type === "downtime.ended" && e.external_id) {
            await supabaseAdmin.from("downtime_events")
              .update({ ended_at: e.ended_at ?? new Date().toISOString() })
              .eq("external_id", e.external_id);
          }

          await supabaseAdmin.from("integration_events").insert({
            source: "mes", direction: "inbound", event_type: e.event_type, status: "ok", payload: e as never,
          });
        } catch (err) {
          await supabaseAdmin.from("integration_events").insert({
            source: "mes", direction: "inbound", event_type: e.event_type, status: "error",
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
