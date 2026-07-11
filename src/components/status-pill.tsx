import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  // sales order
  draft: "text-muted-foreground",
  confirmed: "text-info",
  in_production: "text-primary",
  partially_shipped: "text-warning",
  shipped: "text-success",
  delivered: "text-success",
  cancelled: "text-destructive",
  // prod / wo
  planned: "text-muted-foreground",
  released: "text-info",
  in_progress: "text-primary",
  paused: "text-warning",
  completed: "text-success",
  pending: "text-muted-foreground",
  // ws
  active: "text-success",
  maintenance: "text-warning",
  offline: "text-destructive",
  packed: "text-info",
  // lines
  running: "text-success",
  hold: "text-destructive",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const c = styles[status] ?? "text-muted-foreground";
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider whitespace-nowrap",
        c,
        className,
      )}
    >
      <span className={cn("status-dot", c, (status === "in_progress" || status === "running") && "animate-pulse-glow")} />
      {label}
    </span>
  );
}
