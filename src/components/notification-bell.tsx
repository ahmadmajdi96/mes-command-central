import { useMemo } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications, useMarkAllRead, useMarkNotificationRead } from "@/lib/notifications-db";
import { useSession } from "@/hooks/use-session";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const { user } = useSession();
  const { data: items = [] } = useNotifications(50);
  const markAll = useMarkAllRead();
  const markOne = useMarkNotificationRead();

  const unread = useMemo(
    () => (user ? items.filter((n) => !(n.read_by ?? []).includes(user.id)) : items),
    [items, user],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-lg border border-border/60 bg-card/60 p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Notifications</span>
          {user && unread.length > 0 && (
            <button
              onClick={() => markAll.mutate(user.id)}
              className="text-[11px] text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">No activity yet.</p>
          )}
          {items.map((n) => {
            const isRead = user ? (n.read_by ?? []).includes(user.id) : true;
            return (
              <button
                key={n.id}
                onClick={() => user && markOne.mutate({ id: n.id, userId: user.id, currentReadBy: n.read_by ?? [] })}
                className={`flex w-full items-start gap-2 border-b border-border/40 px-3 py-2 text-left text-xs hover:bg-card/60 ${isRead ? "opacity-70" : ""}`}
              >
                {!isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium capitalize">
                    {n.entity_table.replace(/_/g, " ")} {n.action}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {n.entity_id?.slice(0, 8) ?? "—"} · {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
