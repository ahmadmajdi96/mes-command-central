import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export const Route = createFileRoute("/api/public/oms/orders")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
        const status = url.searchParams.get("status");

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        // Safe projection only
        let q = supabase.from("sales_orders")
          .select("id, number, status, total_amount, currency, created_at, updated_at, promised_date")
          .order("created_at", { ascending: false }).limit(limit);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        return new Response(JSON.stringify({ orders: data ?? [] }), {
          status: 200, headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
