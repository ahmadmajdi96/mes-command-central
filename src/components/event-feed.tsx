import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, X, Play, Pause, CheckCircle2, Circle, MessageSquare, Activity, CheckCheck } from "lucide-react";
import { useStore, store, type FeedEventKind } from "@/lib/store";
import { cn } from "@/lib/utils";

const iconFor = (kind: FeedEventKind) => {
  switch (kind) {
    case "wo_start":
    case "wo_resume":
      return <Play className="h-3.5 w-3.5 text-success" />;
    case "wo_pause": return <Pause className="h-3.5 w-3.5 text-warning" />;
    case "wo_complete": return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
    case "sop_check": return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    case "sop_uncheck": return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
    case "sop_note": return <MessageSquare className="h-3.5 w-3.5 text-info" />;
    default: return <Activity className="h-3.5 w-3.5 text-primary" />;
  }
};

export function EventFeed() {
  const events = useStore((s) => s.events);
  const unread = events.filter((e) => !e.read).length;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 text-xs hover:bg-card"
        aria-label="Event feed"
      >
        <Bell className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Activity</span>
        {unread > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-medium text-primary-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="glass-panel absolute right-4 top-14 z-50 flex max-h-[70vh] w-[380px] flex-col rounded-2xl border border-border/60 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 p-3">
              <div>
                <h3 className="text-sm font-semibold">Event Feed</h3>
                <p className="text-[11px] text-muted-foreground">
                  {unread > 0 ? `${unread} unread` : "All caught up"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => store.markAllEventsRead()} title="Mark all read"
                  className="flex items-center gap-1 rounded-md p-1 text-[11px] text-muted-foreground hover:bg-card hover:text-foreground">
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => store.clearEvents()} className="text-[11px] text-muted-foreground hover:text-foreground underline">clear</button>
                <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-card"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">No activity yet. Actions on work orders and SOP checklists will appear here.</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {events.map((e) => {
                    const body = (
                      <>
                        <div className="mt-0.5">{iconFor(e.kind)}</div>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-xs", e.read && "text-muted-foreground")}>{e.message}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{e.at} · {e.user}</p>
                        </div>
                        {!e.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                      </>
                    );
                    const cls = cn(
                      "flex items-start gap-2 rounded-lg border p-2 transition-colors",
                      e.read ? "border-border/30 bg-transparent" : "border-primary/20 bg-primary/5 hover:bg-primary/10",
                    );
                    return (
                      <li key={e.id}>
                        {e.href ? (
                          <Link to={e.href} onClick={() => { store.markEventRead(e.id); setOpen(false); }} className={cls}>
                            {body}
                          </Link>
                        ) : (
                          <button onClick={() => store.markEventRead(e.id)} className={cn(cls, "w-full text-left")}>
                            {body}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
