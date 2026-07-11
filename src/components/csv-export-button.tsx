import { Download } from "lucide-react";
import { toast } from "sonner";
import { toCSV, downloadCSV } from "@/lib/csv";

export function CSVExportButton<T extends Record<string, unknown>>({
  filename, rows, columns, label = "Export CSV",
}: {
  filename: string;
  rows: T[];
  columns: { key: keyof T | string; label: string; get?: (row: T) => unknown }[];
  label?: string;
}) {
  return (
    <button
      onClick={() => {
        downloadCSV(filename, toCSV(rows, columns));
        toast.success(`Exported ${rows.length} rows`, { description: `${filename}.csv` });
      }}
      className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-1.5 text-xs hover:bg-card"
    >
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
