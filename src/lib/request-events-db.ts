import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
export type RequestEvent = T["request_events"]["Row"];

export function useRequestEvents(requestId: string | undefined) {
  return useQuery({
    queryKey: ["request_events", requestId],
    enabled: !!requestId,
    queryFn: async (): Promise<RequestEvent[]> => {
      if (!requestId) return [];
      const { data, error } = await supabase
        .from("request_events")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function addRequestEvent(
  requestId: string,
  event_type: string,
  fromStatus: string | null,
  toStatus: string | null,
  notes?: string,
  payload?: Record<string, unknown>,
) {
  const { data: userRes } = await supabase.auth.getUser();
  const actor_id = userRes?.user?.id ?? null;
  const { error } = await supabase.from("request_events").insert({
    request_id: requestId,
    event_type,
    from_status: fromStatus,
    to_status: toStatus,
    actor_id,
    notes: notes ?? null,
    payload: (payload ?? null) as never,
  });
  if (error) throw error;
}

export function useLogRequestEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      requestId: string;
      eventType: string;
      fromStatus?: string | null;
      toStatus?: string | null;
      notes?: string;
      payload?: Record<string, unknown>;
    }) => addRequestEvent(args.requestId, args.eventType, args.fromStatus ?? null, args.toStatus ?? null, args.notes, args.payload),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["request_events", v.requestId] }),
  });
}
