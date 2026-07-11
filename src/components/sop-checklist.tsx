import { useState } from "react";
import { CheckCircle2, Circle, MessageSquare } from "lucide-react";
import { useStore, store, sopStepsFor } from "@/lib/store";

export function SopChecklist({ woId, operation }: { woId: string; operation: string }) {
  const steps = sopStepsFor(operation);
  const entries = useStore((s) => s.sop[woId] ?? []);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const entry = (id: string) => entries.find((e) => e.stepId === id);
  const doneCount = steps.filter((s) => entry(s.id)?.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">SOP Checklist · {operation}</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {doneCount}/{steps.length} · {pct}%
        </span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-success to-info transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="space-y-2">
        {steps.map((step, i) => {
          const e = entry(step.id);
          const done = e?.done ?? false;
          const isOpen = openNote === step.id;
          return (
            <li key={step.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => store.toggleSop(woId, step)}
                  className="mt-0.5 shrink-0"
                  aria-label={done ? "Mark incomplete" : "Mark complete"}
                >
                  {done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>
                      <span className="mr-2 font-mono text-[11px] text-muted-foreground">Step {i + 1}</span>
                      {step.text}
                    </p>
                    {done && e?.at && (
                      <span className="whitespace-nowrap font-mono text-[10px] text-success">✓ {e.at}</span>
                    )}
                  </div>
                  {e?.notes && !isOpen && (
                    <div className="mt-1.5 rounded-md border border-info/30 bg-info/5 p-2 text-[11px] text-muted-foreground">
                      <span className="font-medium text-info">Note · </span>
                      {e.notes}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setDraft(e?.notes ?? "");
                      setOpenNote(isOpen ? null : step.id);
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                  >
                    <MessageSquare className="h-3 w-3" />
                    {e?.notes ? "Edit note" : "Add note"}
                  </button>
                  {isOpen && (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={draft}
                        onChange={(ev) => setDraft(ev.target.value)}
                        rows={2}
                        placeholder="Operator note (batch, deviation, observation)…"
                        className="w-full rounded-lg border border-border/60 bg-card/60 p-2 text-xs focus:border-primary/50 focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setOpenNote(null)} className="rounded-md px-2 py-1 text-[11px] text-muted-foreground">Cancel</button>
                        <button
                          onClick={() => { store.setSopNote(woId, step.id, draft); setOpenNote(null); }}
                          className="rounded-md bg-primary/10 border border-primary/30 px-2 py-1 text-[11px] text-primary"
                        >
                          Save note
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
