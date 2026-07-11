import { Radio } from "lucide-react";
import { useStore, store } from "@/lib/store";

export function LiveIndicator() {
  const live = useStore((s) => s.live);
  const tick = useStore((s) => s.tick);
  return (
    <button
      onClick={() => store.setLive(!live)}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition ${
        live ? "border-success/40 bg-success/10 text-success" : "border-border/60 bg-card/60 text-muted-foreground"
      }`}
      title="Toggle real-time updates"
    >
      <Radio className={`h-3 w-3 ${live ? "animate-pulse" : ""}`} />
      {live ? "LIVE" : "PAUSED"}
      <span className="font-mono text-[10px] opacity-60">·{tick}</span>
    </button>
  );
}
