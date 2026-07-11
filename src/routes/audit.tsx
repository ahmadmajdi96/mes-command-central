import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { History, Search } from "lucide-react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit Log · CORTA OMS" }] }),
  component: AuditPage,
});

function AuditPage() {
  const audit = useStore((s) => s.audit);
  const [q, setQ] = useState("");
  const filtered = audit.filter((a) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return a.action.toLowerCase().includes(s) || a.entity.toLowerCase().includes(s) || a.detail.toLowerCase().includes(s) || a.user.toLowerCase().includes(s);
  });

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
              { key: "detail", label: "Detail" },
            ]}
          />
        }
      />

      <div className="glass-panel flex items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by action, entity, user or detail…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
      </div>

      <Panel>
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3">
              <History className="mt-0.5 h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{a.action}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{a.at}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                <p className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>by <span className="font-mono">{a.user}</span></span>
                  <span>entity <span className="font-mono">{a.entity}</span></span>
                  <span className="font-mono">{a.id}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
