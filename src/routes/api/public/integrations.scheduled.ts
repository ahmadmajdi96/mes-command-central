import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { runScheduled } from "@/lib/integration-hub.server";

/** Called by the scheduler every few minutes: sends due outbound messages, escalates exceptions, runs alert rules. */
export const Route = createFileRoute("/api/public/integrations/scheduled")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.INTEGRATION_WEBHOOK_SECRET ?? "";
        const got = Buffer.from(request.headers.get("x-webhook-secret") ?? "");
        const exp = Buffer.from(secret);
        if (!secret || got.length !== exp.length || !timingSafeEqual(got, exp)) return new Response("Unauthorized", { status: 401 });
        const r = await runScheduled();
        return new Response(JSON.stringify({ ok: true, ...r }), { headers: { "content-type": "application/json" } });
      },
    },
  },
});
