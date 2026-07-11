import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { Server, Database, Shield, Cpu } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · CORTA OMS" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="System Settings" subtitle="Global configuration for CORTA OMS" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Deployment</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Environment" value="production" mono />
            <Field label="API Version" value="v1.0.4" mono />
            <Field label="App Port" value="3000" mono />
            <Field label="Node Version" value="20.11 LTS" mono />
            <Field label="Instances" value="3 behind LB" />
            <Field label="Uptime" value="42 days" />
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Database</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Engine" value="PostgreSQL 15.4" />
            <Field label="Host" value="db.internal" mono />
            <Field label="Pool" value="20 conn" mono />
            <Field label="Size" value="18.4 GB" mono />
            <Field label="Last Backup" value="2026-07-11 02:00" mono />
            <Field label="Replica Lag" value="12 ms" mono />
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Authentication</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Strategy" value="JWT (HS256)" />
            <Field label="Expiry" value="24h" mono />
            <Field label="Password Policy" value="Min 12 chars, 3 classes" />
            <Field label="MFA" value="Optional (TOTP)" />
            <Field label="CORS Origins" value="corta.yourplant.com" />
            <Field label="Rate Limit" value="120 req/min" mono />
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Observability</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Log Level" value="info" mono />
            <Field label="Log Sink" value="stdout → Loki" />
            <Field label="Metrics" value="Prometheus /metrics" mono />
            <Field label="Tracing" value="OpenTelemetry (OTLP)" />
            <Field label="Alerting" value="PagerDuty · P1/P2" />
            <Field label="Error Rate 24h" value="0.02%" mono />
          </div>
        </Panel>
      </div>

      <Panel>
        <h3 className="mb-3 text-sm font-semibold">Notification Preferences</h3>
        <div className="space-y-2">
          {[
            { l: "Sales order created", d: "Email order manager on new SO" },
            { l: "Production order released", d: "Notify planner and supervisor" },
            { l: "Work order overdue", d: "Alert supervisor after 30m past due" },
            { l: "Inventory low stock", d: "Send when available < reorder point" },
            { l: "Shipment delivered", d: "Notify order manager and customer" },
          ].map((n, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 p-3">
              <div>
                <div className="text-sm font-medium">{n.l}</div>
                <div className="text-[11px] text-muted-foreground">{n.d}</div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input type="checkbox" defaultChecked={i < 4} className="peer sr-only" />
                <div className="peer h-5 w-9 rounded-full bg-muted peer-checked:bg-primary transition-colors">
                  <div className="h-5 w-5 rounded-full bg-background border border-border shadow-sm transition-transform peer-checked:translate-x-4" />
                </div>
              </label>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
