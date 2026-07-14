import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AppNotification {
  id: string;
  entity_table: string;
  entity_id: string | null;
  action: string;
  summary: string | null;
  actor_id: string | null;
  payload: unknown;
  read_by: string[];
  created_at: string;
}

export const notificationsKey = ["notifications"] as const;

export function useNotifications(limit = 50) {
  return useQuery({
    queryKey: [...notificationsKey, limit],
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from("notifications" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as AppNotification[];
    },
    refetchOnWindowFocus: false,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, userId, currentReadBy }: { id: string; userId: string; currentReadBy: string[] }) => {
      if (currentReadBy.includes(userId)) return;
      const next = [...currentReadBy, userId];
      const { error } = await supabase.from("notifications" as never).update({ read_by: next } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await supabase.from("notifications" as never).select("id,read_by").limit(200);
      const rows = (data ?? []) as Array<{ id: string; read_by: string[] }>;
      const toUpdate = rows.filter((r) => !(r.read_by ?? []).includes(userId));
      for (const r of toUpdate) {
        await supabase.from("notifications" as never)
          .update({ read_by: [...(r.read_by ?? []), userId] } as never)
          .eq("id", r.id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}

/** Subscribe globally: refetch the notifications list + surface a toast for new rows. */
export function useNotificationsRealtime(currentUserId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("rt-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as AppNotification;
          qc.invalidateQueries({ queryKey: notificationsKey });
          // Don't toast for the actor's own actions
          if (currentUserId && n.actor_id === currentUserId) return;
          const label = `${n.entity_table.replace(/_/g, " ")} ${n.action}`;
          toast(label, { description: n.summary ?? undefined });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, currentUserId]);
}
