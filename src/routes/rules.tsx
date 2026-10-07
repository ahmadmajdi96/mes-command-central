import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { AnalyticsCards } from "@/components/analytics-cards";
import { CSVExportButton } from "@/components/csv-export-button";
import { FormDialog } from "@/components/form-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCustomers, useProducts, useRealtimeInvalidate } from "@/lib/oms-db";
import { useLocations } from "@/lib/inventory-db";
import { orchKey, useRules, useRuleHistory, useSaveRule, useDeleteRule, CHANNELS, type BusinessRule, type RuleHistory } from "@/lib/orchestration-db";

export const Route = createFileRoute("/rules")({
  head: () => ({ meta: [
    { title: "Business Rules · OMS" },
    { name: "description", content: "Configure sourcing, routing and hold rules that drive order orchestration." },
    { property: "og:title", content: "Business Rules · OMS" },
    { property: "og:description", content: "Configure sourcing, routing and hold rules that drive order orchestration." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: RulesPage,
});

const TYPES = [
  { value: "sourcing", label: "Sourcing — prefer a location" },
  { value: "routing", label: "Routing — assign an order route" },
  { value: "hold", label: "Hold — put matching orders on hold" },
];

function RulesPage() {
  useRealtimeInvalidate("business_rules" as never, [orchKey]);
  const { data: rules = [], isLoading } = useRules();
  const { data: history = [] } = useRuleHistory();
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: locs = [] } = useLocations();
  const save = useSaveRule(); const del = useDeleteRule();
  const [tab, setTab] = useState<"rules" | "history">("rules");
  const [edit, setEdit] = useState<Partial<BusinessRule> | null>(null);
  const [toDel, setToDel] = useState<BusinessRule | null>(null);
  const [type, setType] = useState("all");
  const [test, setTest] = useState<{ rule: BusinessRule; rows: any[] | null; error?: string } | null>(null);
  const runTest = async (r: BusinessRule) => {
    setTest({ rule: r, rows: null });
    const { data, error } = await (supabase.rpc as any)("preview_rule", { _conditions: r.conditions ?? {} });
    setTest({ rule: r, rows: data ?? [], error: error?.message });
  };

  const cName = (id?: string) => customers.find((c) => c.id === id)?.name;
  const pName = (id?: string) => products.find((p) => p.id === id)?.sku;
  const lName = (id?: string) => locs.find((l) => l.id === id)?.code;
  const today = new Date().toISOString().slice(0, 10);
  const effective = (r: BusinessRule) => r.active && (!r.effective_from || r.effective_from <= today) && (!r.effective_to || r.effective_to >= today);

  const describeCond = (r: Partial<BusinessRule>) => {
    const c = r.conditions ?? {};
    const parts = [
      c.channel && `channel = ${c.channel}`, c.order_type && `type = ${c.order_type}`,
      c.customer_id && `customer = ${cName(c.customer_id) ?? "?"}`, c.product_id && `product = ${pName(c.product_id) ?? "?"}`,
      c.min_total && `total ≥ ${c.min_total}`, c.max_total && `total ≤ ${c.max_total}`,
    ].filter(Boolean);
    return parts.length ? parts.join(" AND ") : "All orders";
  };
  const describeAction = (r: Partial<BusinessRule>) => {
    const a = r.action ?? {};
    if (r.rule_type === "sourcing") return `Prefer ${lName(a.location_id) ?? "—"}`;
    if (r.rule_type === "routing") return `Route: ${a.route ?? "—"}`;
    return `Hold: ${a.reason ?? r.name}`;
  };

  const filtered = rules.filter((r) => type === "all" || r.rule_type === type);
  const cards = useMemo(() => [
    { label: "Rules", value: rules.length, accent: "primary" as const },
    { label: "In effect", value: rules.filter(effective).length, accent: "success" as const },
    { label: "Sourcing", value: rules.filter((r) => r.rule_type === "sourcing").length, accent: "info" as const },
    { label: "Routing", value: rules.filter((r) => r.rule_type === "routing").length, accent: "accent" as const },
    { label: "Hold", value: rules.filter((r) => r.rule_type === "hold").length, accent: "warning" as const },
    { label: "Changes logged", value: history.length, accent: "info" as const },
  ], [rules, history]);

  const opt = (arr: { value: string; label: string }[]) => [{ value: "", label: "Any" }, ...arr];

  return (
    <div className="space-y-5">
      <PageHeader title="Business Rules" subtitle={isLoading ? "Loading…" : `${rules.length} rules · evaluated by priority (lowest first)`}
        actions={<div className="flex gap-2">
          <CSVExportButton filename="business-rules" rows={filtered} columns={[
            { key: "name", label: "Name" }, { key: "rule_type", label: "Type" }, { key: "priority", label: "Priority" },
            { key: "cond", label: "Condition", get: (r) => describeCond(r) }, { key: "act", label: "Action", get: (r) => describeAction(r) },
            { key: "active", label: "Active" }, { key: "effective_from", label: "From" }, { key: "effective_to", label: "To" },
          ]} />
          <button onClick={() => setEdit({ rule_type: "sourcing", priority: 100, active: true })} className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
            <Plus className="h-3.5 w-3.5" /> New Rule
          </button>
        </div>} />
      <AnalyticsCards cards={cards} />
      <div className="glass-panel flex flex-wrap items-center gap-1 rounded-2xl p-3">
        {(["rules", "history"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${tab === t ? "border border-primary/30 bg-primary/15 text-primary" : "border border-transparent text-muted-foreground"}`}>{t === "history" ? "Change history" : "Rules"}</button>
        ))}
        {tab === "rules" && <select value={type} onChange={(e) => setType(e.target.value)} className="ml-auto h-8 rounded-lg border border-border/60 bg-card/60 px-2 text-xs">
          <option value="all">All types</option>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
        </select>}
      </div>

      {tab === "rules" ? (
        <DataTable<BusinessRule> rows={filtered} defaultSort={{ key: "priority", dir: "asc" }} empty="No rules yet — orders use location priority by default" columns={[
          { key: "priority", label: "Priority", sortAccessor: (r) => r.priority, render: (r) => <span className="font-mono text-xs">{r.priority}</span> },
          { key: "name", label: "Name", sortAccessor: (r) => r.name, render: (r) => <span className="text-sm font-medium">{r.name}</span> },
          { key: "type", label: "Type", render: (r) => <span className="text-xs capitalize">{r.rule_type}</span> },
          { key: "cond", label: "When", render: (r) => <span className="text-xs text-muted-foreground">{describeCond(r)}</span> },
          { key: "act", label: "Then", render: (r) => <span className="text-xs">{describeAction(r)}</span> },
          { key: "eff", label: "Effective", render: (r) => <span className="text-xs">{r.effective_from ?? "…"} → {r.effective_to ?? "…"}</span> },
          { key: "state", label: "State", render: (r) => <span className={`text-xs ${effective(r) ? "text-success" : "text-muted-foreground"}`}>{effective(r) ? "In effect" : r.active ? "Scheduled/expired" : "Disabled"}</span> },
          { key: "a", label: "", align: "right", render: (r) => (
            <div className="flex justify-end gap-1">
              <button onClick={() => runTest(r)} className="mr-1 text-[11px] text-primary hover:underline">Test</button>
              <button onClick={() => setEdit(r)} aria-label="Edit"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
              <button onClick={() => setToDel(r)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
            </div>) },
        ]} />
      ) : (
        <DataTable<RuleHistory> rows={history} empty="No rule changes yet" columns={[
          { key: "at", label: "When", sortAccessor: (h) => h.at, render: (h) => <span className="text-xs">{new Date(h.at).toLocaleString()}</span> },
          { key: "change", label: "Change", render: (h) => <span className="text-xs capitalize">{h.change}</span> },
          { key: "name", label: "Rule", render: (h) => <span className="text-xs">{h.snapshot?.name ?? "—"}</span> },
          { key: "detail", label: "Details", render: (h) => <span className="text-xs text-muted-foreground">{h.snapshot ? `${describeCond(h.snapshot)} → ${describeAction(h.snapshot)} · priority ${h.snapshot.priority} · ${h.snapshot.active ? "active" : "disabled"}` : ""}</span> },
        ]} />
      )}

      <Dialog open={!!test} onOpenChange={(o) => !o && setTest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Test run: {test?.rule.name}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">When {test ? describeCond(test.rule) : ""} → {test ? describeAction(test.rule) : ""}. Nothing is changed; this only shows which open orders would match today.</p>
          {test?.rows == null ? <p className="text-xs">Checking…</p> : test.error ? <p className="text-xs text-destructive">{test.error}</p> : (
            <div className="max-h-80 space-y-1 overflow-auto">
              <p className="text-xs font-medium">{test.rows.length} open order(s) match{!effective(test.rule) ? " — note: this rule is not in effect right now" : ""}</p>
              {test.rows.map((o) => (
                <div key={o.order_id} className="flex justify-between border-b border-border/40 py-1 text-xs">
                  <Link to="/orders/$orderId" params={{ orderId: o.order_id }} className="font-mono text-primary hover:underline">{o.number}</Link>
                  <span className="text-muted-foreground">{o.channel} · {o.status} · ${Number(o.total).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <FormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Edit rule" : "New rule"} submitLabel="Save rule"
        description="Leave a condition empty to match any value."
        initial={edit ? {
          name: edit.name ?? "", rule_type: edit.rule_type ?? "sourcing", priority: edit.priority ?? 100, active: String(edit.active ?? true),
          effective_from: edit.effective_from ?? "", effective_to: edit.effective_to ?? "", notes: edit.notes ?? "",
          channel: edit.conditions?.channel ?? "", customer_id: edit.conditions?.customer_id ?? "", product_id: edit.conditions?.product_id ?? "",
          min_total: edit.conditions?.min_total ?? "", max_total: edit.conditions?.max_total ?? "",
          location_id: edit.action?.location_id ?? "", route: edit.action?.route ?? "", reason: edit.action?.reason ?? "",
        } : undefined}
        fields={[
          { name: "name", label: "Rule name", required: true },
          { name: "rule_type", label: "Type", type: "select", options: TYPES },
          { name: "priority", label: "Priority (lower runs first)", type: "number" },
          { name: "active", label: "Enabled", type: "select", options: [{ value: "true", label: "Enabled" }, { value: "false", label: "Disabled" }] },
          { name: "channel", label: "When channel is", type: "select", options: opt(CHANNELS.map((c) => ({ value: c, label: c }))) },
          { name: "customer_id", label: "When customer is", type: "select", options: opt(customers.map((c) => ({ value: c.id, label: c.name }))) },
          { name: "product_id", label: "When product is (sourcing only)", type: "select", options: opt(products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))) },
          { name: "min_total", label: "When order total ≥", type: "number" },
          { name: "max_total", label: "When order total ≤", type: "number" },
          { name: "location_id", label: "Then prefer location (sourcing)", type: "select", options: opt(locs.map((l) => ({ value: l.id, label: `${l.code} — ${l.name}` }))) },
          { name: "route", label: "Then route name (routing)" },
          { name: "reason", label: "Then hold reason (hold)" },
          { name: "effective_from", label: "Effective from", type: "date" },
          { name: "effective_to", label: "Effective to", type: "date" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        onSubmit={async (v: any) => {
          if (v.rule_type === "sourcing" && !v.location_id) throw new Error("Sourcing rules need a preferred location");
          if (v.rule_type === "routing" && !v.route) throw new Error("Routing rules need a route name");
          if (v.effective_from && v.effective_to && v.effective_to < v.effective_from) throw new Error("Effective end must be after start");
          const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, x]) => x !== "" && x !== 0 && x != null).map(([k, x]) => [k, String(x)]));
          await save.mutateAsync({
            id: edit?.id, name: v.name, rule_type: v.rule_type, priority: Math.round(Number(v.priority) || 100), active: v.active !== "false",
            effective_from: v.effective_from || null, effective_to: v.effective_to || null, notes: v.notes || null,
            conditions: clean({ channel: v.channel, customer_id: v.customer_id, product_id: v.product_id, min_total: v.min_total, max_total: v.max_total }),
            action: clean(v.rule_type === "sourcing" ? { location_id: v.location_id } : v.rule_type === "routing" ? { route: v.route } : { reason: v.reason || v.name }),
          });
          setEdit(null);
        }} />
      <ConfirmDialog open={!!toDel} onOpenChange={(o) => !o && setToDel(null)} title="Delete this rule?" variant="destructive"
        description="The change is kept in the rule history." onConfirm={async () => { if (toDel) await del.mutateAsync(toDel.id); setToDel(null); }} />
    </div>
  );
}
