import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { Search } from "lucide-react";
import { useStore } from "@/lib/store";
import type { AuditLog } from "@/lib/oms-data";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit Log · CORTA OMS" }] }),
  component: AuditPage,
});

const entityType = (entity: string) => {
  const prefix = entity.split("-")[0]?.toUpperCase() ?? "OTHER";
  const map: Record<string, string> = {
    WO: "Work Order", SO: "Sales Order", PO: "Production Order",
    CUS: "Customer", P: "Product", SH: "Shipment", U: "User", INV: "Inventory",
  };
  return map[prefix] ?? prefix;
};

function AuditPage() {
  const audit = useStore((s) => s.audit);
  const [q, setQ] = useState("");
  const [user, setUser] = useState("all");
  const [ent, setEnt] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const users = useMemo(() => ["all", ...Array.from(new Set(audit.map((a) => a.user))).sort()], [audit]);
  const entities = useMemo(() => ["all", ...Array.from(new Set(audit.map((a) => entityType(a.entity)))).sort()], [audit]);
  const actions = useMemo(() => ["all", ...Array.from(new Set(audit.map((a) => a.action))).sort()], [audit]);

  const filtered = useMemo(() => audit.filter((a) => {
    if (user !== "all" && a.user !== user) return false;
    if (ent !== "all" && entityType(a.entity) !== ent) return false;
    if (action !== "all" && a.action !== action) return false;
    if (from && a.at < from) return false;
    if (to && a.at > `${to} 23:59:59`) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(a.action.toLowerCase().includes(s) || a.entity.toLowerCase().includes(s) ||
        a.detail.toLowerCase().includes(s) || a.user.toLowerCase().includes(s))) return false;
    }
    return true;
  }), [audit, q, user, ent, action, from, to]);

  const reset = () => { setQ(""); setUser("all"); setEnt("all"); setAction("all"); setFrom(""); setTo(""); };
  const activeCount = [user !== "all", ent !== "all", action !== "all", !!from, !!to, !!q].filter(Boolean).length;

  const selectCls = "h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs focus:border-primary/50 focus:outline-none";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        subtitle={`${filtered.length} of ${audit.length} events · immutable`}
        actions={
          <CSVExportButton
            filename="audit-log"
            rows={filtered}
            columns={[
              { key: "id", label: "ID" },
              { key: "at", label: "Timestamp" },
              { key: "user", label: "User" },
              { key: "action", label: "Action" },
              { key: "entity", label: "Entity" },
              { key: "entityType", label: "Entity Type", get: (a) => entityType(a.entity) },
              { key: "detail", label: "Detail" },
            ]}
          />
        }
      />

      <div className="glass-panel space-y-3 rounded-2xl p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by action, entity, user or detail…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">User</span>
            <select value={user} onChange={(e) => setUser(e.target.value)} className={selectCls}>
              {users.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
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

      <DataTable<AuditLog>
        rows={filtered}
        defaultSort={{ key: "at", dir: "desc" }}
        columns={[
          { key: "at", label: "When", sortAccessor: (a) => a.at, render: (a) => <span className="font-mono text-[11px] text-muted-foreground">{a.at}</span> },
          { key: "user", label: "User", sortAccessor: (a) => a.user, render: (a) => <span className="font-mono text-xs">{a.user}</span> },
          { key: "action", label: "Action", sortAccessor: (a) => a.action, render: (a) => <span className="text-xs font-medium">{a.action}</span> },
          { key: "entityType", label: "Type", sortAccessor: (a) => entityType(a.entity), render: (a) => <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{entityType(a.entity)}</span> },
          { key: "entity", label: "Entity", sortAccessor: (a) => a.entity, render: (a) => <span className="font-mono text-[11px] text-muted-foreground">{a.entity}</span> },
          { key: "detail", label: "Detail", render: (a) => <span className="text-xs text-muted-foreground">{a.detail}</span> },
          { key: "id", label: "ID", render: (a) => <span className="font-mono text-[10px] text-muted-foreground">{a.id}</span> },
        ]}
        empty="No audit events match your filters"
      />
    </div>
  );
}
