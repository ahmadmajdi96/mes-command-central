import { cn } from "@/lib/utils";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";

export function PageHeader({
  title, subtitle, actions, breadcrumb,
}: {
  title: string; subtitle?: string; actions?: ReactNode; breadcrumb?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {breadcrumb && <div className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{breadcrumb}</div>}
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("glass-panel rounded-2xl p-5", className)}>{children}</div>;
}

export function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm", mono && "font-mono")}>{value}</div>
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  sortAccessor?: (row: T) => string | number;
}

export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [50, 100, 200, 300];

export function DataTable<T>({
  columns, rows, empty = "No records", pageSize: initialPageSize = DEFAULT_PAGE_SIZE, defaultSort,
  getRowId, bulkActions,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  pageSize?: number;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  getRowId?: (row: T) => string;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(defaultSort ?? null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortAccessor) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = col.sortAccessor!(a);
      const bv = col.sortAccessor!(b);
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const toggleSort = (c: Column<T>) => {
    if (!c.sortAccessor) return;
    setSort((prev) => {
      if (!prev || prev.key !== c.key) return { key: c.key, dir: "asc" };
      if (prev.dir === "asc") return { key: c.key, dir: "desc" };
      return null;
    });
  };

  const rowId = (r: T, i: number) => (getRowId ? getRowId(r) : String(i));
  const selectedRows = getRowId ? rows.filter((r) => selected.has(getRowId(r))) : [];
  const clear = () => setSelected(new Set());

  const pageIds = pageRows.map((r, i) => rowId(r, i));
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (rows.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center rounded-2xl p-12 text-center">
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {getRowId && bulkActions && selectedRows.length > 0 && (
        <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border-primary/40 bg-primary/5 p-3">
          <div className="text-xs">
            <span className="font-mono text-sm text-primary">{selectedRows.length}</span>{" "}
            <span className="text-muted-foreground">selected</span>
            <button onClick={clear} className="ml-3 text-[11px] text-muted-foreground hover:text-foreground underline">clear</button>
          </div>
          <div className="flex items-center gap-2">{bulkActions(selectedRows, clear)}</div>
        </div>
      )}

      <div className="glass-panel overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                {getRowId && (
                  <th className="w-8 px-3 py-3">
                    <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage}
                      className="h-3.5 w-3.5 accent-primary" />
                  </th>
                )}
                {columns.map((c) => {
                  const isSorted = sort?.key === c.key;
                  return (
                    <th key={c.key} className={cn("px-4 py-3 font-medium", c.align === "right" && "text-right")}>
                      {c.sortAccessor ? (
                        <button onClick={() => toggleSort(c)}
                          className={cn("inline-flex items-center gap-1 hover:text-foreground", isSorted && "text-primary")}>
                          {c.label}
                          {!isSorted && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                          {isSorted && sort?.dir === "asc" && <ArrowUp className="h-3 w-3" />}
                          {isSorted && sort?.dir === "desc" && <ArrowDown className="h-3 w-3" />}
                        </button>
                      ) : c.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                const id = rowId(row, i);
                const isSel = getRowId ? selected.has(id) : false;
                return (
                  <tr key={id} className={cn("border-b border-border/40 last:border-0 hover:bg-card/60", isSel && "bg-primary/5")}>
                    {getRowId && (
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={isSel} onChange={() => toggleRow(id)}
                          className="h-3.5 w-3.5 accent-primary" />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-4 py-3", c.align === "right" && "text-right")}>{c.render(row)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-card/40 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="h-7 rounded-md border border-border/60 bg-card/60 px-1.5 text-[11px] focus:border-primary/50 focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            Showing <span className="font-mono">{sorted.length === 0 ? 0 : currentPage * pageSize + 1}</span>–
            <span className="font-mono">{Math.min(sorted.length, (currentPage + 1) * pageSize)}</span>{" "}
            of <span className="font-mono">{sorted.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}
              className="rounded-md border border-border/60 bg-card/60 p-1 disabled:opacity-40 hover:bg-card">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono">
              {currentPage + 1} / {totalPages}
            </span>
            <button onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))} disabled={currentPage >= totalPages - 1}
              className="rounded-md border border-border/60 bg-card/60 p-1 disabled:opacity-40 hover:bg-card">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
