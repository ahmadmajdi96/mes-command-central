import { useState } from "react";
import { Bookmark, X, Save } from "lucide-react";
import { useSavedPresets } from "@/hooks/use-saved-presets";

export function SavedPresetsBar<T extends Record<string, unknown>>({
  pageKey, current, onApply,
}: {
  pageKey: string;
  current: T;
  onApply: (payload: T) => void;
}) {
  const { presets, save, remove } = useSavedPresets<T>(pageKey, current);
  const [name, setName] = useState("");
  const [showSave, setShowSave] = useState(false);

  return (
    <div className="glass-panel flex flex-wrap items-center gap-2 rounded-2xl border-dashed p-2">
      <Bookmark className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Presets</span>
      {presets.length === 0 && (
        <span className="text-[11px] text-muted-foreground/70">— none yet</span>
      )}
      {presets.map((p) => (
        <span key={p.id} className="group flex items-center gap-1 rounded-full border border-border/60 bg-card/60 pl-2.5 pr-1 py-0.5">
          <button onClick={() => onApply(p.payload)} className="text-[11px] hover:text-primary">{p.name}</button>
          <button onClick={() => remove(p.id)} className="rounded p-0.5 opacity-40 hover:bg-destructive/20 hover:opacity-100">
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <div className="ml-auto flex items-center gap-1">
        {showSave ? (
          <>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Preset name"
              onKeyDown={(e) => { if (e.key === "Enter") { save(name); setName(""); setShowSave(false); } }}
              className="h-7 w-32 rounded-md border border-border/60 bg-card/60 px-2 text-xs focus:border-primary/50 focus:outline-none" />
            <button onClick={() => { save(name); setName(""); setShowSave(false); }}
              className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-primary hover:bg-primary/20">Save</button>
            <button onClick={() => { setShowSave(false); setName(""); }} className="text-[11px] text-muted-foreground hover:text-foreground">cancel</button>
          </>
        ) : (
          <button onClick={() => setShowSave(true)}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[11px] hover:bg-card">
            <Save className="h-3 w-3" /> Save current
          </button>
        )}
      </div>
    </div>
  );
}
