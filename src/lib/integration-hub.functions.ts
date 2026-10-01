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
    return runScheduled();
  });

/** Send a signed sample message through the real inbound pipeline (for testing a connection). */
export const sendTestInbound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ system: z.enum(["erp", "wms", "fulfillment", "channel"]), type: z.string().min(1).max(64), payload: z.record(z.string(), z.unknown()), message_id: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { receiveInbound } = await import("./integration-hub.server");
    const r = await receiveInbound(data.system, data.message_id, data.type, data.payload, true);
    return r.body as Record<string, unknown>;
  });
