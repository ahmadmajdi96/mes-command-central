import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, FileText, Printer, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentationArticle } from "@/components/documentation-article";
import { DOCUMENTATION_DATE, documentation, searchDocumentation } from "@/lib/documentation";
import "@/components/documentation.css";

export const Route = createFileRoute("/documentation")({
  head: () => ({ meta: [
    { title: "Technical Documentation · MANUQUBE OMS" },
    { name: "description", content: "MANUQUBE OMS technical reference with actual screenshots, detailed operational workflows, data relationships, integration contracts and production runbooks." },
    { property: "og:title", content: "Technical Documentation · MANUQUBE OMS" },
    { property: "og:description", content: "Architecture, access control, full order workflows, signed integration contracts and operational troubleshooting." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DocumentationPage,
});

function DocumentationPage() {
  const [selected, setSelected] = useState("overview");
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const results = useMemo(() => searchDocumentation(query), [query]);
  const chapter = documentation.find((c) => c.id === selected) ?? documentation[0];
  const index = documentation.findIndex((c) => c.id === selected);
  const groups = [...new Set(results.map((c) => c.group))];
  function select(id: string) { setSelected(id); setAll(false); window.scrollTo({ top: 0, behavior: "instant" }); }
  if (!chapter) return null;
  const visible = all ? documentation : [chapter];
  return <div className="technical-documentation mx-auto max-w-[1440px]">
    <header className="mb-7 flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
      <div><div className="mb-2 flex items-center gap-2 text-xs text-primary"><BookOpen className="h-4 w-4" />MANUQUBE OMS · SYSTEM REFERENCE</div><h1 className="font-display text-2xl font-semibold">Technical Documentation</h1><p className="mt-2 text-xs leading-6 text-muted-foreground">Revision {DOCUMENTATION_DATE} · {documentation.length} chapters · 11 actual screen captures</p></div>
      <div className="flex flex-wrap gap-2 print:hidden"><Button variant="outline" size="sm" aria-pressed={all} onClick={() => setAll((v) => !v)}><FileText />{all ? "Chapter view" : "Full document"}</Button><Button variant="outline" size="sm" onClick={() => { setAll(true); setTimeout(() => window.print(), 200); }}><Printer />Print / PDF</Button></div>
    </header>
    <div className="doc-layout grid items-start gap-8 xl:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="space-y-5 xl:sticky xl:top-20 print:hidden">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search documentation" placeholder="Search documentation…" className="h-10 pl-9 pr-9" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <Button size="icon" variant="ghost" className="absolute right-0 top-0 h-10 w-8" aria-label="Clear documentation search" onClick={() => setQuery("")}><X /></Button>}</div>
        <nav aria-label="Documentation chapters" className="max-h-[65vh] space-y-6 overflow-y-auto pr-2 xl:max-h-[calc(100vh-220px)]">
          {query && <p role="status" className="text-xs text-muted-foreground">{results.length} matching chapters</p>}
          {!results.length && <p className="text-sm text-muted-foreground">No matching chapters.</p>}
          {groups.map((group) => <div key={group}><h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</h2><div className="space-y-1">{results.filter((c) => c.group === group).map((c) => <Button key={c.id} variant="ghost" onClick={() => select(c.id)} aria-current={!all && c.id === selected ? "page" : undefined} className={`h-auto w-full justify-start whitespace-normal px-3 py-2.5 text-left text-xs leading-5 ${!all && c.id === selected ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}><span className="shrink-0 font-mono text-[10px]">{String(documentation.indexOf(c) + 1).padStart(2, "0")}</span><span>{c.title}</span></Button>)}</div></div>)}
        </nav>
      </aside>
      <div className="min-w-0">
        {visible.map((c) => <DocumentationArticle key={c.id} chapter={c} index={documentation.indexOf(c)} />)}
        {!all && <div className="mt-7 flex items-center justify-between gap-3 border-t border-border pt-5 print:hidden"><Button variant="outline" size="sm" disabled={index <= 0} onClick={() => { const prev = documentation[index - 1]; if (prev) select(prev.id); }}><ArrowLeft />Previous chapter</Button><span className="text-xs text-muted-foreground">{index + 1} / {documentation.length}</span><Button variant="outline" size="sm" disabled={index >= documentation.length - 1} onClick={() => { const next = documentation[index + 1]; if (next) select(next.id); }}>Next chapter<ArrowRight /></Button></div>}
      </div>
    </div>
  </div>;
}