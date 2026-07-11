import { createFileRoute } from "@tanstack/react-router";
import { users } from "@/lib/oms-data";
import { StatusPill } from "@/components/status-pill";
import { PageHeader, DataTable } from "@/components/page-shell";
import { Plus, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/users")({
  head: () => ({ meta: [{ title: "Users & Roles · CORTA OMS" }] }),
  component: UsersPage,
});

const roleStyle: Record<string, string> = {
  admin: "text-destructive border-destructive/30 bg-destructive/10",
  order_manager: "text-primary border-primary/30 bg-primary/10",
  production_planner: "text-info border-info/30 bg-info/10",
  supervisor: "text-accent border-accent/30 bg-accent/10",
  operator: "text-muted-foreground border-border/60 bg-card/60",
};

function UsersPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Users & Roles"
        subtitle={`${users.length} users · ${users.filter(u => u.active).length} active`}
        actions={
          <button className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
            <Plus className="h-3.5 w-3.5" /> New User
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(["admin", "order_manager", "production_planner", "supervisor", "operator"] as const).map(r => (
          <div key={r} className="glass-panel rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{r.replace("_", " ")}</span>
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold">{users.filter(u => u.role === r).length}</div>
          </div>
        ))}
      </div>

      <DataTable
        rows={users}
        columns={[
          { key: "u", label: "Username", render: (u) => <span className="font-mono text-xs text-primary">{u.username}</span> },
          { key: "n", label: "Full Name", render: (u) => <span className="text-sm">{u.fullName}</span> },
          { key: "e", label: "Email", render: (u) => <span className="font-mono text-xs text-muted-foreground">{u.email}</span> },
          { key: "r", label: "Role", render: (u) => (
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${roleStyle[u.role]}`}>{u.role.replace("_", " ")}</span>
          )},
          { key: "s", label: "Status", render: (u) => <StatusPill status={u.active ? "active" : "offline"} /> },
        ]}
      />
    </div>
  );
}
