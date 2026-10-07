import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/page-shell";
import { EXC_TYPES, usePeople } from "@/lib/exceptions-db";

type Rule = { id: string; type: string; owner_id: string; enabled: boolean };
const T = () => supabase.from("exception_assignment_rules" as never) as any;
const sel = "h-8 rounded-md border border-border/60 bg-card/60 px-2 text-xs";

/** Auto-owner by exception type: new exceptions without an owner get the person set here. */
export function ExceptionAssignmentPanel() {
  const qc = useQueryClient();
  const { data: people = [] } = usePeople();
  const { data: rules = [] } = useQuery({ queryKey: ["exc-assign"], queryFn: async (): Promise<Rule[]> => {
    const { data, error } = await T().select("*").order("type"); if (error) throw error; return data ?? [];
  } });
  const [type, setType] = useState(""); const [owner, setOwner] = useState("");
  const m = useMutation({
    mutationFn: async (fn: () => Promise<{ error: any }>) => { const { error } = await fn(); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exc-assign"] }); toast.success("Assignment rules updated"); },
    onError: (e: any) => toast.error(e.message?.includes("duplicate") ? "That type already has a rule" : e.message),
  });
  const name = (id: string) => { const p = people.find((x) => x.id === id); return p?.display_name || p?.email || "Unknown"; };
  return (
    <Panel>
      <h3 className="text-sm font-semibold">Assignment rules</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">New exceptions with no owner are given to this person automatically, by type.</p>
      <div className="space-y-1.5">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="capitalize">{r.type.replace(/_/g, " ")} → <b>{name(r.owner_id)}</b></span>
            <span className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-muted-foreground"><input type="checkbox" checked={r.enabled} onChange={(e) => m.mutate(() => T().update({ enabled: e.target.checked }).eq("id", r.id))} /> On</label>
              <button className="text-destructive hover:underline" onClick={() => m.mutate(() => T().delete().eq("id", r.id))}>Remove</button>
            </span>
          </div>
        ))}
        {!rules.length && <p className="text-xs text-muted-foreground">No rules yet.</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className={sel} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Exception type…</option>
          {EXC_TYPES.filter((t) => !rules.some((r) => r.type === t)).map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <select className={sel} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Owner…</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.email}</option>)}
        </select>
        <button disabled={!type || !owner || m.isPending} className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary disabled:opacity-50"
          onClick={() => m.mutate(() => T().insert({ type, owner_id: owner }), { onSuccess: () => { setType(""); setOwner(""); } } as any)}>Add rule</button>
      </div>
    </Panel>
  );
}
