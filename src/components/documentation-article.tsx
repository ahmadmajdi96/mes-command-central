import { useState } from "react";
import { Copy, Check, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { DocChapter } from "@/lib/documentation";

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setError(false); setTimeout(() => setCopied(false), 1800); }
    catch { setError(true); }
  }
  return <div className="relative my-5 overflow-hidden rounded-lg border border-border bg-muted/40">
    <Button size="icon" variant="ghost" className="absolute right-2 top-2 print:hidden" aria-label="Copy code" title="Copy code" onClick={copy}>{copied ? <Check /> : <Copy />}</Button>
    <pre className="overflow-x-auto p-5 pr-14 font-mono text-xs leading-6 text-foreground"><code>{code}</code></pre>
    {error && <p role="status" className="px-5 pb-3 text-xs text-warning">Copy unavailable. Select the text to copy it.</p>}
  </div>;
}

export function DocumentationArticle({ chapter, index }: { chapter: DocChapter; index: number }) {
  const [zoom, setZoom] = useState(false);
  return <article id={chapter.id} className="doc-article min-w-0">
    <header className="border-b border-border pb-6">
      <div className="mb-3 flex items-center gap-3 text-xs text-primary"><span className="font-mono">{String(index + 1).padStart(2, "0")}</span><span>{chapter.group}</span></div>
      <h2 className="font-display text-3xl font-semibold leading-tight">{chapter.title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{chapter.summary}</p>
    </header>
    {chapter.image && <figure className="my-7">
      <div className="relative overflow-hidden rounded-lg border border-border bg-card">
        <img src={chapter.image.url} alt={chapter.image.alt} className="h-auto w-full" loading="eager" width={1024} height={700} />
        <Button variant="secondary" size="icon" title="Enlarge screenshot" aria-label={`Enlarge ${chapter.title} screenshot`} onClick={() => setZoom(true)} className="absolute bottom-3 right-3 print:hidden"><ZoomIn /></Button>
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">{chapter.image.caption}</figcaption>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">{chapter.image.callouts.map((callout, i) => <li key={callout} className="flex gap-2 text-xs leading-6"><span className="font-mono text-primary">{i + 1}.</span><span>{callout}</span></li>)}</ol>
      <Dialog open={zoom} onOpenChange={setZoom}><DialogContent className="max-w-6xl"><DialogTitle>{chapter.title}</DialogTitle><DialogDescription>{chapter.image.caption}</DialogDescription><img src={chapter.image.url} alt={chapter.image.alt} className="h-auto w-full" /></DialogContent></Dialog>
    </figure>}
    <div className="space-y-8 py-7">{chapter.blocks.map((block) => <section key={block.title} className="min-w-0">
      <h3 className="mb-3 text-lg font-semibold">{block.title}</h3>
      {block.paragraphs?.map((p) => <p key={p} className="mb-3 text-sm leading-7 text-muted-foreground">{p}</p>)}
      {block.steps && <ol className="space-y-5">{block.steps.map((step, i) => <li key={step.title} className="flex gap-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 font-mono text-xs text-primary">{i + 1}</span><div><h4 className="text-sm font-semibold">{step.title}</h4><p className="mt-1 text-sm leading-7 text-muted-foreground">{step.detail}</p></div></li>)}</ol>}
      {block.bullets && <ul className="space-y-3">{block.bullets.map((b) => <li key={b} className="flex gap-3 text-sm leading-7 text-muted-foreground"><span className="text-primary" aria-hidden="true">•</span><span>{b}</span></li>)}</ul>}
      {block.code && <CodeBlock code={block.code} />}
      {block.table && <div className="my-4 overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[560px] text-left text-xs leading-6"><caption className="sr-only">{block.table.title}</caption><thead className="bg-muted/40"><tr>{block.table.columns.map((c) => <th key={c} scope="col" className="px-4 py-3 font-semibold">{c}</th>)}</tr></thead><tbody>{block.table.rows.map((row) => <tr key={row[0]} className="border-t border-border">{row.map((cell, i) => <td key={i} className={`px-4 py-3 align-top ${i === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>{cell}</td>)}</tr>)}</tbody></table></div>}
      {block.note && <aside className="mt-4 border-l-2 border-warning bg-warning/5 px-4 py-3 text-xs leading-6 text-muted-foreground"><strong className="text-warning">Important · </strong>{block.note}</aside>}
    </section>)}</div>
    <footer className="border-t border-border py-4"><h3 className="text-xs font-semibold text-muted-foreground">Implementation references</h3><ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{chapter.source.map((s) => <li key={s} className="break-all font-mono text-[10px] text-muted-foreground">{s}</li>)}</ul></footer>
  </article>;
}