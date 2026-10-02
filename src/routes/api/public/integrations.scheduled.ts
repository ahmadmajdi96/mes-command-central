import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { runScheduled } from "@/lib/integration-hub.server";

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return a.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

/** Called by the database scheduler every 5 minutes (x-cron-token) or by an external scheduler (x-webhook-secret). */
export const Route = createFileRoute("/api/public/integrations/scheduled")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const secret = process.env.INTEGRATION_WEBHOOK_SECRET ?? "";
        const cron = request.headers.get("x-cron-token") ?? "";
        let ok = same(request.headers.get("x-webhook-secret") ?? "", secret);
        if (!ok && cron) {
          const { data } = await db.from("scheduler_token").select("token").eq("id", 1).maybeSingle();
          ok = same(cron, data?.token ?? "");
        }
        if (!ok) return new Response("Unauthorized", { status: 401 });
        try {
          const r = await runScheduled();
          await db.from("scheduler_runs").insert({ source: cron ? "cron" : "external", result: r });
          return new Response(JSON.stringify({ ok: true, ...r }), { headers: { "content-type": "application/json" } });
        } catch (e) {
          await db.from("scheduler_runs").insert({ source: cron ? "cron" : "external", ok: false, result: { error: e instanceof Error ? e.message : String(e) } });
          return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
