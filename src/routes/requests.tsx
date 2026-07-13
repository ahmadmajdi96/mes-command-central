import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Send, Inbox, RefreshCw, ArrowUpRight } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { CSVExportButton } from "@/components/csv-export-button";
import { StatusPill } from "@/components/status-pill";
import { SavedPresetsBar } from "@/components/saved-presets-bar";
import { toast } from "sonner";
import {
  useProductRequests,
  useApproveRequest,
  useRejectRequest,
  deliverRequestToQc,
  type ProductRequest,
  type RequestDirection,
  type RequestStatus,
} from "@/lib/product-requests-db";

import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/requests")({
  head: () => ({ meta: [{ title: "Requests · CORTA OMS" }] }),
  component: RequestsPage,
});

type Preset = { q: string; dir: RequestDirection | "all"; status: RequestStatus | "all" };

const STATUSES: (RequestStatus | "all")[] = ["all", "pending", "in_review", "approved", "rejected", "completed", "cancelled", "failed"];

function RequestsPage() {
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<RequestDirection | "all">("all");
  const [status, setStatus] = useState<RequestStatus | "all">("all");
  const { data: rows = [], isLoading, refetch } = useProductRequests();
  const update = useUpdateProductRequest();
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("rt-product_requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["product_requests"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (dir !== "all" && r.direction !== dir) return false;
    if (status !== "all" && r.status !== status) return false;
    if (q) {
      const s = q.toLowerCase();
      return (
        r.number.toLowerCase().includes(s) ||
        r.title.toLowerCase().includes(s) ||
        (r.description ?? "").toLowerCase().includes(s) ||
        r.target_system.toLowerCase().includes(s)
      );
    }
    return true;
  }), [rows, q, dir, status]);

  const counts = useMemo(() => ({
    outbound: rows.filter((r) => r.direction === "outbound").length,
    inbound: rows.filter((r) => r.direction === "inbound").length,
  }), [rows]);

  const retry = async (r: ProductRequest) => {
    toast.info(`Retrying delivery of ${r.number}…`);
    const res = await deliverRequestToQc(r.id, r.payload);
    if (res.ok) toast.success(`Delivered ${r.number}`);
    else toast.error(`Failed: ${"error" in res ? res.error : "unknown"}`);
    refetch();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Requests"
        subtitle={isLoading ? "Loading…" : `${filtered.length} of ${rows.length} · ${counts.outbound} outbound · ${counts.inbound} inbound`}
        actions={
          <CSVExportButton
            filename="product-requests" rows={filtered}
            columns={[
              { key: "number", label: "Number" },
              { key: "direction", label: "Direction" },
              { key: "kind", label: "Kind" },
              { key: "title", label: "Title" },
              { key: "target_system", label: "Target" },
              { key: "source_system", label: "Source" },
              { key: "status", label: "Status" },
              { key: "delivery_status", label: "Delivery" },
              { key: "created_at", label: "Created" },
            ]}
          />
        }
      />

      <div className="flex items-center gap-2">
        {(["all", "outbound", "inbound"] as const).map((d) => (
          <button key={d} onClick={() => setDir(d)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
              dir === d ? "bg-primary/15 text-primary border border-primary/30" : "border border-border/60 text-muted-foreground hover:text-foreground"
            }`}>
            {d === "outbound" ? <Send className="h-3.5 w-3.5" /> : d === "inbound" ? <Inbox className="h-3.5 w-3.5" /> : null}
            {d}
          </button>
        ))}
      </div>

      <SavedPresetsBar<Preset> pageKey="requests" current={{ q, dir, status }}
        onApply={(p) => { setQ(p.q ?? ""); setDir(p.dir ?? "all"); setStatus(p.status ?? "all"); }} />

      <div className="glass-panel flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, title, target…"
            className="h-9 w-full rounded-lg border border-border/60 bg-card/60 pl-8 pr-3 text-sm focus:border-primary/50 focus:outline-none" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${status === s ? "bg-primary/15 text-primary border border-primary/30" : "border border-transparent text-muted-foreground hover:text-foreground"}`}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <DataTable<ProductRequest>
        rows={filtered}
        defaultSort={{ key: "created_at", dir: "desc" }}
        empty={isLoading ? "Loading…" : "No requests yet"}
        columns={[
          { key: "number", label: "Number", sortAccessor: (r) => r.number, render: (r) => (
            <span className="font-mono text-xs text-primary">{r.number}</span>
          )},
          { key: "direction", label: "Direction", sortAccessor: (r) => r.direction, render: (r) => (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {r.direction === "outbound" ? <Send className="h-3 w-3" /> : <Inbox className="h-3 w-3" />}
              {r.direction}
            </span>
          )},
          { key: "title", label: "Title", render: (r) => (
            <div className="max-w-[320px]">
              <div className="truncate text-sm">{r.title}</div>
              {r.description && <div className="truncate text-[11px] text-muted-foreground">{r.description}</div>}
            </div>
          )},
          { key: "target", label: "Target / Source", render: (r) => (
            <div className="flex flex-col text-xs">
              <span className="text-foreground">{r.target_system}</span>
              {r.source_system && <span className="text-muted-foreground">from {r.source_system}</span>}
            </div>
          )},
          { key: "status", label: "Status", sortAccessor: (r) => r.status, render: (r) => <StatusPill status={r.status} /> },
          { key: "delivery", label: "Delivery", render: (r) => (
            <span className={`text-[11px] ${
              r.delivery_status === "delivered" ? "text-success" :
              r.delivery_status === "failed" ? "text-destructive" :
              "text-muted-foreground"
            }`}>
              {r.delivery_status ?? "—"}
              {r.delivery_error && <span className="block text-[10px] opacity-70">{r.delivery_error}</span>}
            </span>
          )},
          { key: "created", label: "Created", align: "right", sortAccessor: (r) => r.created_at, render: (r) => (
            <span className="font-mono text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
          )},
          { key: "actions", label: "", align: "right", render: (r) => (
            <div className="flex items-center justify-end gap-1">
              {r.product_id && (
                <Link to="/products/$productId" params={{ productId: r.product_id }}
                  className="rounded-md border border-border/60 px-2 py-1 text-[10px] hover:text-primary hover:border-primary/40 inline-flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" /> Product
                </Link>
              )}
              {r.direction === "outbound" && r.delivery_status !== "delivered" && (
                <button onClick={() => retry(r)}
                  className="rounded-md border border-border/60 px-2 py-1 text-[10px] hover:text-primary hover:border-primary/40 inline-flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> Retry
                </button>
              )}
              {r.direction === "inbound" && r.status === "pending" && (
                <>
                  <button onClick={() => update.mutate({ id: r.id, patch: { status: "approved" } })}
                    className="rounded-md border border-success/40 bg-success/10 px-2 py-1 text-[10px] text-success">Approve</button>
                  <button onClick={() => update.mutate({ id: r.id, patch: { status: "rejected" } })}
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">Reject</button>
                </>
              )}
            </div>
          )},
        ]}
      />
    </div>
  );
}
