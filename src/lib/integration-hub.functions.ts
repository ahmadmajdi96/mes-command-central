import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const retryIntegrationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { retryMessage } = await import("./integration-hub.server");
    return retryMessage(data.id);
  });

export const runIntegrationScheduler = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { runScheduled } = await import("./integration-hub.server");
    const r = await runScheduled();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("scheduler_runs").insert({ source: "manual", result: r });
    return r;
  });

/** Send a signed sample message through the real inbound pipeline (for testing a connection). */
export const sendTestInbound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ system: z.enum(["erp", "wms", "fulfillment", "channel"]), type: z.string().min(1).max(64), payload: z.record(z.string(), z.unknown()), message_id: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { receiveInbound } = await import("./integration-hub.server");
    const r = await receiveInbound(data.system, data.message_id, data.type, data.payload, true);
    return JSON.parse(JSON.stringify(r.body)) as { ok: boolean; duplicate?: boolean; error?: string; message?: string };
  });

/** Admin-only: ask Lovable AI to explain a failed message and suggest a safe next step. */
export const explainIntegrationFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only operations admins can use AI explanations");
    const { data: m, error } = await sb.from("integration_messages").select("*").eq("id", data.id).maybeSingle();
    if (error || !m) throw new Error("Message not found");
    if (!["failed", "dead", "held"].includes(m.status)) throw new Error("Only failed, dead or held messages can be explained");
    const { data: ep } = m.endpoint_id ? await sb.from("integration_endpoints").select("url, enabled, events").eq("id", m.endpoint_id).maybeSingle() : { data: null };
    const { explainFailure } = await import("./ai-explain.server");
    const ex = await explainFailure(m, ep);
    const at = new Date().toISOString();
    await sb.from("integration_messages").update({ ai_explanation: ex, ai_explained_at: at }).eq("id", data.id);
    return { ...ex, explained_at: at };
  });
