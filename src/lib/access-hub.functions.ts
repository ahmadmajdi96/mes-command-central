import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sync the signed-in person's rights from the Command Access Hub (cached 5 min) and return effective access. */
export const getMyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { force?: boolean } | undefined) => ({ force: !!d?.force }))
  .handler(async ({ data, context }) => {
    const { syncUserFromHub, effectiveAccess } = await import("./access-hub.server");
    const email = String((context.claims as any)?.email ?? "").toLowerCase();
    let syncError: string | null = null;
    if (email) {
      try { await syncUserFromHub(context.userId, email, data.force); } catch (e) { syncError = e instanceof Error ? e.message : String(e); console.error("hub sync", e); }
    }
    const access = await effectiveAccess(context.userId);
    return { ...access, syncError };
  });
