import { useState, useEffect } from "react";
import { CheckCircle2, Circle, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { useSopSteps, useUpdateSopStep, useCreateSopStep, useRealtimeInvalidate, sopKey } from "@/lib/oms-db";
import { sopStepsFor } from "@/lib/store";

export function SopChecklist({ woId, operation }: { woId: string; operation: string }) {
  const { data: steps = [], isLoading } = useSopSteps(woId);
  const update = useUpdateSopStep();
  const create = useCreateSopStep();
  useRealtimeInvalidate("sop_steps", [sopKey(woId)]);

  const [openNote, setOpenNote] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [seeding, setSeeding] = useState(false);

  // Auto-seed default checklist from operation on first view
  useEffect(() => {
    if (!isLoading && steps.length === 0 && !seeding && woId) {
      const template = sopStepsFor(operation);
      setSeeding(true);
      Promise.all(
        template.map((t, i) =>
          create.mutateAsync({ work_order_id: woId, seq: (i + 1) * 10, title: t.text }),
        ),
      ).finally(() => setSeeding(false));
    }
  }, [isLoading, steps.length, woId, operation]); // eslint-disable-line

  const doneCount = steps.filter((s) => s.completed).length;
  const pct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

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
      {isLoading || seeding ? (
        <p className="text-sm text-muted-foreground">Loading checklist…</p>
      ) : (
        <ol className="space-y-2">
          {steps.map((step, i) => {
            const isOpen = openNote === step.id;
            return (
              <li key={step.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => update.mutate({ id: step.id, woId, patch: { completed: !step.completed } })}
                    className="mt-0.5 shrink-0"
                    aria-label={step.completed ? "Mark incomplete" : "Mark complete"}
                  >
                    {step.completed ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={`text-sm ${step.completed ? "line-through text-muted-foreground" : ""}`}>
                        <span className="mr-2 font-mono text-[11px] text-muted-foreground">Step {i + 1}</span>
                        {step.title}
                      </p>
                      {step.completed && step.completed_at && (
                        <span className="whitespace-nowrap font-mono text-[10px] text-success">✓ {new Date(step.completed_at).toLocaleTimeString()}</span>
                      )}
                    </div>
                    {step.notes && !isOpen && (
                      <div className="mt-1.5 rounded-md border border-info/30 bg-info/5 p-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-info">Note · </span>
                        {step.notes}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setDraft(step.notes ?? "");
                        setOpenNote(isOpen ? null : step.id);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                    >
                      <MessageSquare className="h-3 w-3" />
                      {step.notes ? "Edit note" : "Add note"}
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
                            onClick={async () => {
                              await update.mutateAsync({ id: step.id, woId, patch: { notes: draft } });
                              setOpenNote(null);
                              toast.success("Note saved");
                            }}
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
      )}
      <button
        onClick={async () => {
          const title = prompt("New step title");
          if (!title) return;
          await create.mutateAsync({ work_order_id: woId, seq: (steps.length + 1) * 10, title });
          toast.success("Step added");
        }}
        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Add step
      </button>
    </div>
  );
}
