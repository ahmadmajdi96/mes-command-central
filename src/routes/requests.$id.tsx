import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Send, Inbox, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-shell";
import { StatusPill } from "@/components/status-pill";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useUpdateProductRequest,
  deliverRequestToQc,
  type ProductRequest,
} from "@/lib/product-requests-db";

export const Route = createFileRoute("/requests/$id")({
  head: ({ params }) => ({ meta: [{ title: `Request ${params.id.slice(0, 8)} · CORTA OMS` }] }),
  component: RequestDetailPage,
  errorComponent: ({ error }) => (
    <div className="glass-panel rounded-2xl p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">Request not found.</div>
  ),
});

type AuditRow = {
  id: string;
  at: string;
  action: string;
  entity: string;
  detail: string | null;
  user_id: string | null;
};

function useRequest(id: string) {
  return useQuery({
    queryKey: ["product_request", id],
    queryFn: async (): Promise<ProductRequest> => {
      const { data, error } = await supabase
        .from("product_requests")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });
}

function useRequestEvents(id: string) {
  return useQuery({
    queryKey: ["product_request_events", id],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id,at,action,entity,detail,user_id")
        .eq("entity", id)
        .order("at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });
}

function RequestDetailPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const req = useRequest(id);
  const events = useRequestEvents(id);
  const update = useUpdateProductRequest();

  useEffect(() => {
    const ch = supabase
      .channel(`rt-req-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_requests", filter: `id=eq.${id}` }, () => {
        req.refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_log", filter: `entity=eq.${id}` }, () => {
        events.refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const r = req.data;

  const payload = useMemo(() => {
    const p = (r?.payload ?? {}) as Record<string, unknown>;
    const product = (p.product ?? {}) as Record<string, unknown>;
    const steps = (Array.isArray(p.steps) ? p.steps : []) as Array<{ sequence?: number; station_id?: string | null; notes?: string | null }>;
    const meta = (p.meta ?? {}) as Record<string, unknown>;
    return { product, steps, meta, raw: p };
  }, [r?.payload]);

  const retry = async () => {
    if (!r) return;
    toast.info(`Retrying delivery of ${r.number}…`);
    const res = await deliverRequestToQc(r.id, r.payload);
    if (res.ok) toast.success(`Delivered ${r.number}`);
    else toast.error(`Failed: ${"error" in res ? res.error : "unknown"}`);
    router.invalidate();
  };

  if (req.isLoading) {
    return <div className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!r) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={r.title}
        subtitle={
          <span className="flex items-center gap-2">
            <Link to="/requests" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-3 w-3" /> Requests
            </Link>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-mono text-xs text-primary">{r.number}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {r.direction === "outbound" ? <Send className="h-3 w-3" /> : <Inbox className="h-3 w-3" />}
              {r.direction}
            </span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {r.direction === "outbound" && r.delivery_status !== "delivered" && (
              <button onClick={retry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:text-primary hover:border-primary/40">
                <RefreshCw className="h-3.5 w-3.5" /> Retry delivery
              </button>
            )}
            {r.direction === "inbound" && r.status === "pending" && (
              <>
                <button onClick={() => update.mutate({ id: r.id, patch: { status: "approved" } })}
                  className="rounded-lg border border-success/40 bg-success/10 px-3 py-1.5 text-xs text-success">Approve</button>
                <button onClick={() => update.mutate({ id: r.id, patch: { status: "rejected" } })}
                  className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">Reject</button>
              </>
            )}
            {r.product_id && (
              <Link to="/products/$productId" params={{ productId: r.product_id }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:text-primary hover:border-primary/40">
                <ExternalLink className="h-3.5 w-3.5" /> Product
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Status"><StatusPill status={r.status} /></Field>
        <Field label="Kind"><span className="text-sm capitalize">{r.kind.replace(/_/g, " ")}</span></Field>
        <Field label="Delivery">
          <span className={`text-sm ${
            r.delivery_status === "delivered" ? "text-success" :
            r.delivery_status === "failed" ? "text-destructive" :
            "text-muted-foreground"
          }`}>
            {r.delivery_status ?? "—"}
            {r.delivery_error && <span className="block text-[11px] opacity-70">{r.delivery_error}</span>}
          </span>
        </Field>
        <Field label="Target system"><span className="text-sm">{r.target_system}</span></Field>
        <Field label="Source system"><span className="text-sm">{r.source_system ?? "—"}</span></Field>
        <Field label="Assignee">
          <span className="font-mono text-xs text-muted-foreground">{r.assignee_id ?? "unassigned"}</span>
        </Field>
        <Field label="Requester">
          <span className="font-mono text-xs text-muted-foreground">{r.requester_id ?? "—"}</span>
        </Field>
        <Field label="Created">
          <span className="font-mono text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
        </Field>
        <Field label="Updated">
          <span className="font-mono text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleString()}</span>
        </Field>
      </div>

      {r.description && (
        <section className="glass-panel rounded-2xl p-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</h3>
          <p className="whitespace-pre-wrap text-sm">{r.description}</p>
        </section>
      )}

      <section className="glass-panel rounded-2xl p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Product</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <KV label="SKU" value={payload.product.sku as string | undefined} mono />
          <KV label="Name" value={payload.product.name as string | undefined} />
          <KV label="Category id" value={payload.product.category_id as string | undefined} mono />
          <KV label="Description" value={payload.product.description as string | undefined} />
        </div>
        {payload.meta && Object.keys(payload.meta).length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {Object.entries(payload.meta).map(([k, v]) => (
              <KV key={k} label={k} value={v == null ? "" : String(v)} />
            ))}
          </div>
        )}
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Routing steps ({payload.steps.length})
        </h3>
        {payload.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No routing steps defined.</p>
        ) : (
          <ol className="space-y-2">
            {payload.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
                  {s.sequence ?? i + 1}
                </span>
                <div className="flex-1 space-y-0.5">
                  <div className="font-mono text-xs text-foreground">{s.station_id ?? "—"}</div>
                  {s.notes && <div className="text-xs text-muted-foreground">{s.notes}</div>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="glass-panel rounded-2xl p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Audit trail ({events.data?.length ?? 0})
        </h3>
        {events.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading events…</p>
        ) : (events.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded yet.</p>
        ) : (
          <ol className="relative space-y-3 border-l border-border/60 pl-4">
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-[11px] text-primary">{e.action}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
                {e.detail && <div className="text-xs text-muted-foreground">{e.detail}</div>}
                {e.user_id && <div className="font-mono text-[10px] text-muted-foreground/70">by {e.user_id.slice(0, 8)}…</div>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <details className="glass-panel rounded-2xl p-4">
        <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Raw payload
        </summary>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-card/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
{JSON.stringify(payload.raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm ${mono ? "font-mono text-xs" : ""}`}>{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}
