import { createFileRoute } from "@tanstack/react-router";
import { auditLog } from "@/lib/oms-data";
import { PageHeader, Panel } from "@/components/page-shell";
import { History } from "lucide-react";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit Log · CORTA OMS" }] }),
  component: AuditPage,
});

function AuditPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Audit Log" subtitle="Immutable record of user actions" />
      <Panel>
        <div className="space-y-2">
          {auditLog.map(a => (
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
