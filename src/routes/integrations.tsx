import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RotateCw, Play, FlaskConical, Sparkles, Clock } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, DataTable, Panel } from "@/components/page-shell";
import { AnalyticsCards } from "@/components/analytics-cards";
import { CSVExportButton } from "@/components/csv-export-button";
import { StatusPill } from "@/components/status-pill";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { retryIntegrationMessage, runIntegrationScheduler, sendTestInbound, explainIntegrationFailure } from "@/lib/integration-hub.functions";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [
    { title: "Integration Monitor · OMS" },
    { name: "description", content: "Messages exchanged with ERP, warehouse, fulfillment partners and sales channels, with retries." },
    { property: "og:title", content: "Integration Monitor · OMS" },
    { property: "og:description", content: "Messages exchanged with ERP, warehouse, fulfillment partners and sales channels, with retries." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: IntegrationsPage,
});

type Msg = { id: string; message_id: string; system: string; direction: string; message_type: string; status: string; payload: unknown; response: unknown; error: string | null; signature_valid: boolean | null; attempts: number; next_retry_at: string | null; created_at: string; processed_at: string | null };
type Endpoint = { id: string; system: string; name: string; url: string | null; enabled: boolean; events: string[] };
const KEY = ["integration_messages"];
const SYS_LABEL: Record<string, string> = { erp: "ERP", wms: "Warehouse (WMS)", fulfillment: "Fulfillment / 3PL", channel: "Sales channel" };
const EVENTS = ["order.created", "order.status_changed", "fulfillment.instruction", "fulfillment.status_changed"];
const QUEUES = ["All", "Inbound", "Outbound", "Failed", "Waiting", "Duplicates blocked"] as const;
const SAMPLES: Record<string, Record<string, unknown>> = {
  "order.create": { external_id: "WEB-1001", channel: "web", customer: { name: "Test Customer", email: "test@example.com" }, lines: [{ sku: "SKU", qty: 1 }] },
  "order.status": { order_number: "SO-2026-0001", status: "on_hold" },
  "shipment.confirm": { fulfillment_number: "FUL-2026-0001", carrier: "DHL", tracking: "123" },
  "inventory.adjust": { sku: "SKU", location_code: "WH-01", type: "receipt", qty: 10 },
};

function IntegrationsPage() {
  useRealtimeInvalidate("integration_messages" as never, [KEY]);
  const qc = useQueryClient();
  const retryFn = useServerFn(retryIntegrationMessage);
  const runFn = useServerFn(runIntegrationScheduler);
  const testFn = useServerFn(sendTestInbound);
  const [q, setQ] = useState<typeof QUEUES[number]>("All");
  const [sys, setSys] = useState("");
  const [open, setOpen] = useState<Msg | null>(null);

  const { data: msgs = [], isLoading } = useQuery({ queryKey: KEY, queryFn: async (): Promise<Msg[]> => {
    const { data, error } = await supabase.from("integration_messages" as never).select("*").order("created_at", { ascending: false }).limit(2000);
    if (error) throw error; return (data ?? []) as unknown as Msg[];
  } });
  const { data: eps = [] } = useQuery({ queryKey: [...KEY, "eps"], queryFn: async (): Promise<Endpoint[]> => {
    const { data, error } = await supabase.from("integration_endpoints" as never).select("*").order("system");
    if (error) throw error; return (data ?? []) as unknown as Endpoint[];
  } });
  const saveEp = useMutation({
    mutationFn: async (e: Partial<Endpoint> & { id: string }) => {
      if (e.url && !/^https:\/\/[^\s]+$/i.test(e.url)) throw new Error("Address must start with https://");
      const { error } = await supabase.from("integration_endpoints" as never).update(e as never).eq("id", e.id); if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Connection saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const retry = useMutation({
    mutationFn: (id: string) => retryFn({ data: { id } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: KEY }); r.ok ? toast.success("Retry succeeded") : toast.error(`Retry failed: ${r.error ?? "unknown error"}`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const run = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r) => { qc.invalidateQueries(); toast.success(`Sent ${r.dispatch.sent}, failed ${r.dispatch.failed} · ${r.escalated} escalated · ${r.alerts_fired} alerts`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const test: Record<typeof QUEUES[number], (m: Msg) => boolean> = {
    All: () => true, Inbound: (m) => m.direction === "inbound", Outbound: (m) => m.direction === "outbound",
    Failed: (m) => ["failed", "dead"].includes(m.status), Waiting: (m) => ["pending", "held", "received"].includes(m.status), "Duplicates blocked": () => false,
  };
  const filtered = msgs.filter((m) => test[q](m) && (!sys || m.system === sys));
  const cards = useMemo(() => [
    { label: "Messages", value: msgs.length, accent: "primary" as const },
    { label: "Inbound", value: msgs.filter(test.Inbound).length, accent: "info" as const },
    { label: "Outbound", value: msgs.filter(test.Outbound).length, accent: "accent" as const },
    { label: "Processed / sent", value: msgs.filter((m) => ["processed", "sent"].includes(m.status)).length, accent: "success" as const },
    { label: "Failed", value: msgs.filter(test.Failed).length, accent: "destructive" as const },
    { label: "Waiting", value: msgs.filter(test.Waiting).length, accent: "warning" as const },
  ], [msgs]);

  return (
    <div className="space-y-5">
      <PageHeader title="Integration Monitor" subtitle={isLoading ? "Loading…" : "ERP, warehouse, fulfillment partners and sales channels"}
        actions={<>
          <button onClick={() => run.mutate()} disabled={run.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary disabled:opacity-50"><Play className="h-3.5 w-3.5" /> Send waiting now</button>
          <CSVExportButton filename={`integration-messages-${q}`} rows={filtered} columns={[
            { key: "created_at", label: "Time" }, { key: "system", label: "System" }, { key: "direction", label: "Direction" }, { key: "message_type", label: "Type" },
            { key: "message_id", label: "Message ID" }, { key: "status", label: "Status" }, { key: "attempts", label: "Attempts" }, { key: "error", label: "Error" },
          ]} />
        </>} />
      <AnalyticsCards cards={cards} />

      <Panel>
        <h3 className="mb-1 text-sm font-semibold">Connections (outgoing)</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">Where the OMS sends updates. Every message is signed (X-Signature: sha256 HMAC of the body with your shared secret) and carries an X-Message-Id. Failed sends retry up to 5 times with growing waits.</p>
        <div className="space-y-2">{eps.map((e) => <EndpointRow key={e.id} ep={e} onSave={(v) => saveEp.mutate(v)} />)}</div>
        <div className="mt-4 rounded-lg border border-border/60 bg-card/40 p-3 text-[11px] text-muted-foreground">
          <b className="text-foreground">Incoming address</b> for other systems: <code className="text-foreground">{typeof window !== "undefined" ? window.location.origin : ""}/api/public/integrations/&lt;erp|wms|fulfillment|channel&gt;</code> — POST {"{"} "type", "payload" {"}"} with the same signature and message ID headers. Types: order.create, order.status, order.cancel, shipment.confirm, fulfillment.status, inventory.adjust. A repeated message ID is acknowledged but never applied twice.
        </div>
        <TestSender onSend={async (v) => { const r = await testFn({ data: v }); qc.invalidateQueries({ queryKey: KEY }); (r as any).ok ? toast.success((r as any).duplicate ? "Duplicate — ignored as expected" : "Processed") : toast.error(String((r as any).error)); }} />
      </Panel>

      <div className="glass-panel flex flex-wrap items-center gap-1 rounded-2xl p-3">
        {QUEUES.filter((x) => x !== "Duplicates blocked").map((x) => <button key={x} onClick={() => setQ(x)} className={`rounded-lg px-2.5 py-1 text-[11px] ${q === x ? "border border-primary/30 bg-primary/15 text-primary" : "border border-transparent text-muted-foreground"}`}>{x}</button>)}
        <select value={sys} onChange={(e) => setSys(e.target.value)} className="ml-auto h-8 rounded-md border border-border/60 bg-card/60 px-2 text-xs">
          <option value="">All systems</option>{Object.entries(SYS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <DataTable<Msg> rows={filtered} defaultSort={{ key: "t", dir: "desc" }} empty="No messages yet" columns={[
        { key: "t", label: "Time", sortAccessor: (m) => m.created_at, render: (m) => <span className="font-mono text-xs">{new Date(m.created_at).toLocaleString()}</span> },
        { key: "s", label: "System", render: (m) => <span className="text-xs">{SYS_LABEL[m.system] ?? m.system}</span> },
        { key: "d", label: "Direction", render: (m) => <span className={`text-xs ${m.direction === "inbound" ? "text-info" : "text-accent"}`}>{m.direction === "inbound" ? "← in" : "→ out"}</span> },
        { key: "type", label: "Type", render: (m) => <button onClick={() => setOpen(m)} className="font-mono text-xs text-primary hover:underline">{m.message_type}</button> },
        { key: "id", label: "Message ID", render: (m) => <span className="font-mono text-[10px] text-muted-foreground">{m.message_id.slice(0, 18)}</span> },
        { key: "st", label: "Status", render: (m) => <StatusPill status={m.status} /> },
        { key: "a", label: "Tries", align: "right", render: (m) => <span className="font-mono text-xs">{m.attempts}</span> },
        { key: "e", label: "Error / next try", render: (m) => <span className="block max-w-xs truncate text-[11px] text-destructive" title={m.error ?? ""}>{m.error ?? ""}{m.next_retry_at && m.status === "failed" ? <span className="text-muted-foreground"> · next {new Date(m.next_retry_at).toLocaleTimeString()}</span> : null}</span> },
        { key: "r", label: "", align: "right", render: (m) => ["failed", "dead", "held", "pending", "received"].includes(m.status) ? <button disabled={retry.isPending} onClick={() => retry.mutate(m.id)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><RotateCw className="h-3 w-3" /> Retry</button> : null },
      ]} />

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4" onClick={() => setOpen(null)}>
          <div className="glass-panel max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-mono text-sm">{open.message_type} · {open.message_id}</h3><button className="text-xs text-muted-foreground" onClick={() => setOpen(null)}>Close</button></div>
            <div className="mb-2 text-xs text-muted-foreground">Signature {open.signature_valid == null ? "n/a (outgoing, signed by OMS)" : open.signature_valid ? "verified" : "invalid"} · {open.attempts} attempt(s){open.processed_at ? ` · done ${new Date(open.processed_at).toLocaleString()}` : ""}</div>
            <div className="text-[11px] font-semibold">Payload</div>
            <pre className="mb-3 overflow-auto rounded-md bg-card/60 p-2 text-[11px]">{JSON.stringify(open.payload, null, 2)}</pre>
            <div className="text-[11px] font-semibold">Result</div>
            <pre className="overflow-auto rounded-md bg-card/60 p-2 text-[11px]">{JSON.stringify(open.response ?? open.error, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function EndpointRow({ ep, onSave }: { ep: Endpoint; onSave: (v: Partial<Endpoint> & { id: string }) => void }) {
  const [url, setUrl] = useState(ep.url ?? "");
  const [events, setEvents] = useState<string[]>(ep.events);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-2 text-xs">
      <span className="w-40 font-medium">{SYS_LABEL[ep.system] ?? ep.name}</span>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (where to send)" className="h-8 min-w-60 flex-1 rounded-md border border-border/60 bg-card/60 px-2" />
      <div className="flex flex-wrap gap-2">{EVENTS.map((ev) => (
        <label key={ev} className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={events.includes(ev)} onChange={(e) => setEvents(e.target.checked ? [...events, ev] : events.filter((x) => x !== ev))} />{ev}</label>
      ))}</div>
      <label className="flex items-center gap-1"><input type="checkbox" checked={ep.enabled} onChange={(e) => onSave({ id: ep.id, enabled: e.target.checked })} /> On</label>
      <button className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-primary" onClick={() => onSave({ id: ep.id, url: url.trim() || null, events })}>Save</button>
    </div>
  );
}

function TestSender({ onSend }: { onSend: (v: { system: "erp" | "wms" | "fulfillment" | "channel"; type: string; payload: Record<string, unknown>; message_id: string }) => Promise<void> }) {
  const [system, setSystem] = useState<"erp" | "wms" | "fulfillment" | "channel">("channel");
  const [type, setType] = useState("order.create");
  const [body, setBody] = useState(JSON.stringify(SAMPLES["order.create"], null, 2));
  const [mid, setMid] = useState(() => `test-${Date.now()}`);
  const [busy, setBusy] = useState(false);
  return (
    <details className="mt-3 rounded-lg border border-border/60 p-3 text-xs">
      <summary className="flex cursor-pointer items-center gap-1.5 font-medium"><FlaskConical className="h-3.5 w-3.5" /> Send a test incoming message</summary>
      <div className="mt-2 flex flex-wrap gap-2">
        <select value={system} onChange={(e) => setSystem(e.target.value as never)} className="h-8 rounded-md border border-border/60 bg-card/60 px-2">{Object.entries(SYS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={type} onChange={(e) => { setType(e.target.value); setBody(JSON.stringify(SAMPLES[e.target.value] ?? {}, null, 2)); }} className="h-8 rounded-md border border-border/60 bg-card/60 px-2">
          {["order.create", "order.status", "order.cancel", "shipment.confirm", "fulfillment.status", "inventory.adjust"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input value={mid} onChange={(e) => setMid(e.target.value)} className="h-8 w-48 rounded-md border border-border/60 bg-card/60 px-2 font-mono" title="Message ID — reuse it to test duplicate protection" />
        <button onClick={() => setMid(`test-${Date.now()}`)} className="text-[11px] text-muted-foreground">New ID</button>
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} className="mt-2 w-full rounded-md border border-border/60 bg-card/60 p-2 font-mono text-[11px]" />
      <button disabled={busy} className="mt-2 rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50" onClick={async () => {
        let payload: Record<string, unknown>;
        try { payload = JSON.parse(body); } catch { toast.error("Payload is not valid JSON"); return; }
        setBusy(true); try { await onSend({ system, type, payload, message_id: mid }); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
      }}>Send</button>
    </details>
  );
}
