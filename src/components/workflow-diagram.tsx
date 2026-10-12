import { ArrowDown, ArrowRight, CornerDownRight } from "lucide-react";
import type { FlowKind, WorkflowDiagram } from "@/lib/documentation-diagrams";

const style: Record<FlowKind, string> = {
  start: "border-primary/60 bg-primary/10 rounded-full",
  step: "border-border bg-card rounded-lg",
  decision: "border-warning/60 bg-warning/10 rounded-lg border-dashed",
  system: "border-info/50 bg-info/10 rounded-lg",
  end: "border-success/60 bg-success/10 rounded-full",
};

export function WorkflowDiagramView({ diagram }: { diagram: WorkflowDiagram }) {
  return <figure className="doc-diagram my-6 rounded-lg border border-border bg-muted/20 p-5">
    <figcaption className="mb-4 text-xs font-semibold uppercase tracking-wider text-primary">Workflow · {diagram.title}</figcaption>
    <ol className="flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-center">
      {diagram.nodes.map((n, i) => <li key={i} className="flex flex-col items-center gap-2 md:flex-row">
        <div className={`min-w-[120px] max-w-[190px] border px-3 py-2 text-center ${style[n.kind ?? "step"]}`}>
          <div className="text-xs font-medium text-foreground">{n.kind === "decision" ? "◇ " : ""}{n.label}</div>
          {n.detail && <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{n.detail}</div>}
        </div>
        {i < diagram.nodes.length - 1 && <><ArrowRight aria-hidden className="hidden h-4 w-4 text-muted-foreground md:block" /><ArrowDown aria-hidden className="h-4 w-4 text-muted-foreground md:hidden" /></>}
      </li>)}
    </ol>
    {!!diagram.branches?.length && <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
      {diagram.branches.map((b, i) => <li key={i} className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <CornerDownRight className="h-3.5 w-3.5 text-warning" /><span className="font-medium text-foreground">{b.from}</span>
        <span className="rounded border border-warning/40 px-1.5 text-[10px] text-warning">{b.label}</span>
        <ArrowRight className="h-3 w-3" /><span>{b.to}</span>
      </li>)}
    </ul>}
    <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground"><span>○ start/end</span><span className="text-info">■ automatic</span><span className="text-warning">◇ decision</span></div>
  </figure>;
}
