import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader, DataTable } from "@/components/page-shell";
import { AnalyticsCards } from "@/components/analytics-cards";
import { CSVExportButton } from "@/components/csv-export-button";
import { FormDialog } from "@/components/form-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useRealtimeInvalidate } from "@/lib/oms-db";
import { invKey, useLocations, useInventoryLevels, useSaveLocation, useDeleteLocation, type Location } from "@/lib/inventory-db";

export const Route = createFileRoute("/locations")({
  head: () => ({ meta: [
    { title: "Locations · OMS" },
    { name: "description", content: "Warehouses, plants and stores that hold and fulfill inventory." },
    { property: "og:title", content: "Locations · OMS" },
    { property: "og:description", content: "Warehouses, plants and stores that hold and fulfill inventory." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: LocationsPage,
});

const TYPES = ["warehouse", "plant", "store", "supplier", "3pl"].map((v) => ({ value: v, label: v }));

function LocationsPage() {
  useRealtimeInvalidate("locations" as never, [invKey]);
  const { data: locs = [], isLoading } = useLocations();
  const { data: levels = [] } = useInventoryLevels();
  const save = useSaveLocation();
  const del = useDeleteLocation();
  const [edit, setEdit] = useState<Partial<Location> | null>(null);
  const [toDelete, setToDelete] = useState<Location | null>(null);

  const stockAt = (id: string) => levels.filter((l) => l.location_id === id).reduce((s, l) => s + Number(l.on_hand), 0);
  const cards = useMemo(() => [
    { label: "Locations", value: locs.length, accent: "primary" as const },
    { label: "Active", value: locs.filter((l) => l.active).length, accent: "success" as const },
    { label: "Warehouses", value: locs.filter((l) => l.type === "warehouse").length, accent: "info" as const },
    { label: "Units on hand", value: levels.reduce((s, l) => s + Number(l.on_hand), 0).toLocaleString(), accent: "accent" as const },
  ], [locs, levels]);

  return (
    <div className="space-y-5">
      <PageHeader title="Locations" subtitle={isLoading ? "Loading…" : `${locs.length} locations`}
        actions={<div className="flex gap-2">
          <CSVExportButton filename="locations" rows={locs} columns={[
            { key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "type", label: "Type" },
            { key: "priority", label: "Priority" }, { key: "active", label: "Active" }, { key: "address", label: "Address" },
          ]} />
          <button onClick={() => setEdit({})} className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
            <Plus className="h-3.5 w-3.5" /> New Location
          </button>
        </div>} />
      <AnalyticsCards cards={cards} />
      <DataTable<Location> rows={locs} defaultSort={{ key: "priority", dir: "asc" }} empty="No locations yet — add your first warehouse"
        columns={[
          { key: "code", label: "Code", sortAccessor: (l) => l.code, render: (l) => <span className="font-mono text-xs text-primary">{l.code}</span> },
          { key: "name", label: "Name", sortAccessor: (l) => l.name, render: (l) => <span className="text-sm font-medium">{l.name}</span> },
          { key: "type", label: "Type", render: (l) => <span className="text-xs capitalize">{l.type}</span> },
          { key: "priority", label: "Sourcing priority", align: "right", sortAccessor: (l) => l.priority, render: (l) => <span className="font-mono text-xs">{l.priority}</span> },
          { key: "stock", label: "On hand", align: "right", sortAccessor: (l) => stockAt(l.id), render: (l) => <span className="font-mono text-xs">{stockAt(l.id).toLocaleString()}</span> },
          { key: "active", label: "Status", render: (l) => <span className={`text-xs ${l.active ? "text-success" : "text-muted-foreground"}`}>{l.active ? "Active" : "Inactive"}</span> },
          { key: "actions", label: "", align: "right", render: (l) => (
            <div className="flex justify-end gap-1">
              <button onClick={() => setEdit(l)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => setToDelete(l)} className="rounded p-1 text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ) },
        ]} />
      <FormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? "Edit Location" : "New Location"} submitLabel="Save"
        initial={edit ? { ...edit, active: edit.id ? String(edit.active) : "true", priority: edit.priority ?? 100, type: edit.type ?? "warehouse" } : undefined}
        fields={[
          { name: "code", label: "Code", required: true },
          { name: "name", label: "Name", required: true },
          { name: "type", label: "Type", type: "select", options: TYPES },
          { name: "priority", label: "Sourcing priority (lower = preferred)", type: "number" },
          { name: "active", label: "Active", type: "select", options: [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }] },
          { name: "address", label: "Address", type: "textarea" },
        ]}
        onSubmit={async (v: any) => {
          await save.mutateAsync({ id: edit?.id, code: v.code, name: v.name, type: v.type || "warehouse", priority: Math.round(Number(v.priority) || 100), active: v.active !== "false", address: v.address || null });
          setEdit(null);
        }} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Delete this location?"
        description="All stock records at this location will also be removed."
        onConfirm={async () => { if (toDelete) await del.mutateAsync(toDelete.id); setToDelete(null); }} />
    </div>
  );
}
