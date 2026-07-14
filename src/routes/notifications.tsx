import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/page-shell";
import {
  useNotifications,
  useMarkAllRead,
  useMarkNotificationRead,
} from "@/lib/notifications-db";
import { useSession } from "@/hooks/use-session";
import { useRealtimeInvalidate } from "@/lib/oms-db";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications · OMS" }] }),
  component: NotificationsPage,
});

const GROUPS: Record<string, string[]> = {
  orders: ["sales_orders", "sales_order_lines"],
  customers: ["customers"],
  products: ["products", "product_requests"],
  shipments: ["shipments"],
  returns: ["returns", "return_lines"],
  refunds: ["refunds"],
};

type Filter = "all" | keyof typeof GROUPS;

const FILTER_LABELS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "orders", label: "Orders" },
  { key: "customers", label: "Customers" },
  { key: "products", label: "Products" },
  { key: "shipments", label: "Shipments" },
  { key: "returns", label: "Returns" },
  { key: "refunds", label: "Refunds" },
];

function NotificationsPage() {
  const { user } = useSession();
  useRealtimeInvalidate("notifications" as never, [["notifications"]]);
  const { data: items = [], isLoading } = useNotifications(200);
  const markAll = useMarkAllRead();
  const markOne = useMarkNotificationRead();
  const [filter, setFilter] = useState<Filter>("all");
  const [onlyUnread, setOnlyUnread] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filter !== "all" && !GROUPS[filter].includes(n.entity_table)) return false;
      if (onlyUnread && user && (n.read_by ?? []).includes(user.id)) return false;
      return true;
    });
  }, [items, filter, onlyUnread, user]);

  const unreadCount = useMemo(
    () => (user ? items.filter((n) => !(n.read_by ?? []).includes(user.id)).length : 0),
    [items, user],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${items.length} · ${unreadCount} unread`}
        actions={
          user && unreadCount > 0 ? (
            <button
              onClick={() => markAll.mutate(user.id)}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          ) : null
        }
      />

      <div className="glass-panel flex flex-wrap items-center gap-2 rounded-2xl p-3">
        {FILTER_LABELS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              filter === f.key
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={onlyUnread}
              onChange={(e) => setOnlyUnread(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border/60"
            />
            Unread only
          </label>
        </div>
      </div>

      <div className="glass-panel divide-y divide-border/40 rounded-2xl">
        {filtered.length === 0 && (
          <p className="p-8 text-center text-xs text-muted-foreground">
            {isLoading ? "Loading…" : "No notifications match this filter."}
          </p>
        )}
        {filtered.map((n) => {
          const isRead = user ? (n.read_by ?? []).includes(user.id) : true;
          return (
            <button
              key={n.id}
              onClick={() =>
                user && !isRead &&
                markOne.mutate({ id: n.id, userId: user.id, currentReadBy: n.read_by ?? [] })
              }
              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-card/60 ${
                isRead ? "opacity-70" : ""
              }`}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  isRead ? "bg-muted" : "bg-primary"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium capitalize">
                  {n.entity_table.replace(/_/g, " ")} {n.action}
                </div>
                {n.summary && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{n.summary}</div>
                )}
                <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <span>{n.entity_id?.slice(0, 8) ?? "—"}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
