import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { AnalyticsCards } from "@/components/analytics-cards";
import { Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit Log · CORTA OMS" }] }),
  component: AuditPage,
});

type AuditRow = { id: string; at: string; user_id: string | null; action: string; entity: string; detail: string | null };

const entityType = (action: string) => {
  const kind = action.split(".")[0] ?? "other";
  return kind.replace("_", " ");
};

function AuditPage() {
  const qc = useQueryClient();
  const { data: audit = [], isLoading } = useQuery({
    queryKey: ["audit_log"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("rt-audit_log")
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_log" }, () => {
        qc.invalidateQueries({ queryKey: ["audit_log"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [q, setQ] = useState("");
  const [ent, setEnt] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const entities = useMemo(() => ["all", ...Array.from(new Set(audit.map((a) => entityType(a.action)))).sort()], [audit]);
  const actions = useMemo(() => ["all", ...Array.from(new Set(audit.map((a) => a.action))).sort()], [audit]);

  const filtered = useMemo(() => audit.filter((a) => {
    if (ent !== "all" && entityType(a.action) !== ent) return false;
    if (action !== "all" && a.action !== action) return false;
    if (from && a.at < from) return false;
    if (to && a.at > `${to}T23:59:59`) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(a.action.toLowerCase().includes(s) || a.entity.toLowerCase().includes(s) ||
        (a.detail ?? "").toLowerCase().includes(s) || (a.user_id ?? "").toLowerCase().includes(s))) return false;
    }
    return true;
  }), [audit, q, ent, action, from, to]);

  const analytics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = audit.filter((a) => a.at.slice(0, 10) === today).length;
    return [
      { label: "Total events", value: audit.length, accent: "primary" as const },
      { label: "Today", value: todayCount, accent: "info" as const },
      { label: "Distinct actions", value: new Set(audit.map((a) => a.action)).size, accent: "accent" as const },
      { label: "Distinct users", value: new Set(audit.map((a) => a.user_id).filter(Boolean)).size, accent: "success" as const },
    ];
  }, [audit]);

  const reset = () => { setQ(""); setEnt("all"); setAction("all"); setFrom(""); setTo(""); };
  const activeCount = [ent !== "all", action !== "all", !!from, !!to, !!q].filter(Boolean).length;
  const selectCls = "h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs focus:border-primary/50 focus:outline-none";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${audit.length} events · immutable`}
        actions={
          <CSVExportButton
            filename="audit-log"
            rows={filtered}
            columns={[
              { key: "id", label: "ID" },
              { key: "at", label: "Timestamp" },
              { key: "user_id", label: "User" },
              { key: "action", label: "Action" },
              { key: "entity", label: "Entity" },
              { key: "detail", label: "Detail" },
            ]}
          />
        }
      />

      <AnalyticsCards cards={analytics} />

      <div className="glass-panel space-y-3 rounded-2xl p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by action, entity, user or detail…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Entity type</span>
            <select value={ent} onChange={(e) => setEnt(e.target.value)} className={selectCls}>
              {entities.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Action</span>
            <select value={action} onChange={(e) => setAction(e.target.value)} className={selectCls}>
              {actions.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} />
          </label>
        </div>
        {activeCount > 0 && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{activeCount} filter{activeCount === 1 ? "" : "s"} applied</span>
            <button onClick={reset} className="rounded-md border border-border/60 bg-card/60 px-2 py-1 hover:bg-card">Reset filters</button>
          </div>
        )}
      </div>

      <DataTable<AuditRow>
        rows={filtered}
        defaultSort={{ key: "at", dir: "desc" }}
        columns={[
          { key: "at", label: "When", sortAccessor: (a) => a.at, render: (a) => <span className="font-mono text-[11px] text-muted-foreground">{new Date(a.at).toLocaleString()}</span> },
          { key: "user", label: "User", sortAccessor: (a) => a.user_id ?? "", render: (a) => <span className="font-mono text-xs">{a.user_id ? a.user_id.slice(0, 8) : "—"}</span> },
          { key: "action", label: "Action", sortAccessor: (a) => a.action, render: (a) => <span className="text-xs font-medium">{a.action}</span> },
          { key: "entityType", label: "Type", sortAccessor: (a) => entityType(a.action), render: (a) => <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{entityType(a.action)}</span> },
          { key: "entity", label: "Entity", sortAccessor: (a) => a.entity, render: (a) => <span className="font-mono text-[11px] text-muted-foreground">{a.entity.slice(0, 12)}</span> },
          { key: "detail", label: "Detail", render: (a) => <span className="text-xs text-muted-foreground">{a.detail}</span> },
        ]}
        empty={isLoading ? "Loading…" : "No audit events match your filters"}
      />
    </div>
  );
}
