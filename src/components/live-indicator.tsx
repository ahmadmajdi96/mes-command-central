import { Radio } from "lucide-react";
import { useStore, store } from "@/lib/store";

export function LiveIndicator() {
  const live = useStore((s) => s.live);
  const tick = useStore((s) => s.tick);
  return (
    <button
      onClick={() => store.setLive(!live)}
      className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition ${
        live ? "border-success/40 bg-success/10 text-success" : "border-border/60 bg-card/60 text-muted-foreground"
      }`}
      title="Toggle real-time updates"
      aria-label="Real-time updates"
      aria-pressed={live}
    >
      <Radio aria-hidden className={`hidden size-3 sm:block ${live ? "motion-safe:animate-pulse" : ""}`} />
      <span>{live ? "Live" : "Paused"}</span>
      <span className="hidden font-mono text-[10px] opacity-60 xl:inline">·{tick}</span>
    </button>
  );
}
