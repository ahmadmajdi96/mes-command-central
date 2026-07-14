import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Pencil, Trash2, Plus, FileText, Upload, X, Download } from "lucide-react";
import { PageHeader, Panel, Field } from "@/components/page-shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { useProducts, useRealtimeInvalidate, useUpdateProduct, useDeleteProduct, productsKey, productTypeOptions, type Product } from "@/lib/oms-db";
import { uploadProductFiles, deleteProductFile, signedUrlFor, type ProductAttachment } from "@/lib/product-attachments";

export const Route = createFileRoute("/products/$productId")({
  head: () => ({ meta: [{ title: `Product · CORTA OMS` }] }),
  component: ProductDetail,
  notFoundComponent: () => <p className="text-sm text-muted-foreground">Product not found.</p>,
});

function ProductDetail() {
  const { productId } = Route.useParams();
  const router = useRouter();
  useRealtimeInvalidate("products", [productsKey]);
  const { data: products = [], isLoading } = useProducts();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [specDraft, setSpecDraft] = useState("");
  const [critDraft, setCritDraft] = useState("");
  const [uploading, setUploading] = useState(false);

  const p = products.find((x) => x.id === productId || x.sku === productId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!p) return (
    <div className="glass-panel rounded-2xl p-8 text-center">
      <p className="text-sm text-muted-foreground">Product not found.</p>
      <Link to="/products" className="mt-3 inline-flex text-xs text-primary hover:underline">Back to products</Link>
    </div>
  );

  const anyP = p as Product & {
    specifications?: string[];
    acceptance_criteria?: string[];
    attachments?: ProductAttachment[];
    description?: string | null;
  };
  const specs: string[] = Array.isArray(anyP.specifications) ? anyP.specifications : [];
  const crits: string[] = Array.isArray(anyP.acceptance_criteria) ? anyP.acceptance_criteria : [];
  const files: ProductAttachment[] = Array.isArray(anyP.attachments) ? anyP.attachments : [];

  const saveList = async (patch: Partial<Product>) => {
    await updateProduct.mutateAsync({ id: p.id, patch });
  };

  const addSpec = async () => {
    const t = specDraft.trim(); if (!t) return;
    await saveList({ specifications: [...specs, t] } as never);
    setSpecDraft("");
    toast.success("Specification added");
  };
  const rmSpec = async (i: number) => {
    await saveList({ specifications: specs.filter((_, idx) => idx !== i) } as never);
    toast.success("Specification removed");
  };
  const editSpec = async (i: number, value: string) => {
    await saveList({ specifications: specs.map((s, idx) => idx === i ? value : s) } as never);
  };

  const addCrit = async () => {
    const t = critDraft.trim(); if (!t) return;
    await saveList({ acceptance_criteria: [...crits, t] } as never);
    setCritDraft("");
    toast.success("Criterion added");
  };
  const rmCrit = async (i: number) => {
    await saveList({ acceptance_criteria: crits.filter((_, idx) => idx !== i) } as never);
    toast.success("Criterion removed");
  };
  const editCrit = async (i: number, value: string) => {
    await saveList({ acceptance_criteria: crits.map((s, idx) => idx === i ? value : s) } as never);
  };

  const onUpload = async (list: File[]) => {
    if (!list.length) return;
    try {
      setUploading(true);
      const added = await uploadProductFiles(p.id, list);
      await saveList({ attachments: [...files, ...added] } as never);
      toast.success(`${added.length} file(s) uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };
  const rmFile = async (path: string) => {
    try {
      await deleteProductFile(path);
      await saveList({ attachments: files.filter((f) => f.path !== path) } as never);
      toast.success("File removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };
  const openFile = async (path: string) => {
    try {
      const url = await signedUrlFor(path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open file");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={<Link to="/products" className="hover:text-foreground"><span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> Products</span></Link>}
        title={p.name}
        subtitle={`${p.sku} · ${p.type} · ${p.uom}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={() => setConfirmDel(true)}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Description</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{anyP.description ?? "—"}</p>
        </Panel>
        <Panel>
          <h3 className="mb-3 text-sm font-semibold">Details</h3>
          <div className="space-y-3">
            <Field label="SKU" value={p.sku} mono />
            <Field label="Type" value={p.type} />
            <Field label="UOM" value={p.uom} mono />
            <Field label="Standard Cost" value={`$${(p as any).standard_cost ?? 0}`} mono />
            <Field label="Sale Price" value={`$${(p as any).sale_price ?? 0}`} mono />
            <Field label="Batching Limit" value={(p as any).batching_limit ?? "—"} mono />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Specifications</h3>
            <span className="text-[11px] text-muted-foreground">{specs.length}</span>
          </div>
          <ListCrud items={specs} draft={specDraft} setDraft={setSpecDraft} onAdd={addSpec} onRemove={rmSpec} onEdit={editSpec}
            placeholder="e.g. Body material: cast steel A216 WCB" />
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Acceptance Criteria</h3>
            <span className="text-[11px] text-muted-foreground">{crits.length}</span>
          </div>
          <ListCrud items={crits} draft={critDraft} setDraft={setCritDraft} onAdd={addCrit} onRemove={rmCrit} onEdit={editCrit}
            placeholder="e.g. Hydrostatic test at 1.5× design pressure" />
        </Panel>
      </div>

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Attachments</h3>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary">
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload files"}
            <input type="file" multiple className="hidden" disabled={uploading}
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                onUpload(list);
                e.currentTarget.value = "";
              }} />
          </label>
        </div>
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground">No attachments.</p>
        ) : (
          <ul className="space-y-1.5">
            {files.map((f) => (
              <li key={f.path} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/40 px-2.5 py-1.5 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">({Math.round(f.size / 1024)} KB)</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => openFile(f.path)} className="text-muted-foreground hover:text-primary"><Download className="h-3.5 w-3.5" /></button>
                  <button onClick={() => rmFile(f.path)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <EditProductDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        product={p}
        onSave={async (patch) => {
          await updateProduct.mutateAsync({ id: p.id, patch });
          toast.success("Product updated");
          setEditOpen(false);
        }}
      />

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title="Delete product?"
        description={`This will permanently delete ${p.sku} — ${p.name}.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          await deleteProduct.mutateAsync(p.id);
          toast.success("Product deleted");
          router.navigate({ to: "/products" });
        }}
      />
    </div>
  );
}

function ListCrud({
  items, draft, setDraft, onAdd, onRemove, onEdit, placeholder,
}: {
  items: string[];
  draft: string;
  setDraft: (v: string) => void;
  onAdd: () => void | Promise<void>;
  onRemove: (i: number) => void | Promise<void>;
  onEdit: (i: number, v: string) => void | Promise<void>;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [buf, setBuf] = useState("");
  return (
    <div>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          placeholder={placeholder}
          className="h-9 flex-1 rounded-lg border border-border/60 bg-card/60 px-2 text-sm focus:border-primary/50 focus:outline-none" />
        <button onClick={() => onAdd()}
          className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Nothing added yet.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-start justify-between gap-2 rounded-lg border border-border/40 bg-card/40 px-2 py-1.5 text-sm">
              {editing === i ? (
                <>
                  <input value={buf} onChange={(e) => setBuf(e.target.value)}
                    className="h-8 flex-1 rounded-lg border border-border/60 bg-card/60 px-2 text-sm" autoFocus />
                  <button onClick={async () => { await onEdit(i, buf); setEditing(null); }} className="text-xs text-primary">Save</button>
                  <button onClick={() => setEditing(null)} className="text-xs text-muted-foreground">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1">{it}</span>
                  <button onClick={() => { setEditing(i); setBuf(it); }} className="text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditProductDialog({
  open, onOpenChange, product, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product;
  onSave: (patch: Partial<Product>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({
    sku: product.sku,
    name: product.name,
    description: (product as any).description ?? "",
    uom: product.uom ?? "EA",
    type: product.type ?? "finished",
    standard_cost: Number((product as any).standard_cost ?? 0),
    sale_price: Number((product as any).sale_price ?? 0),
    lead_time: Number((product as any).lead_time ?? 0),
    batching_limit: Number((product as any).batching_limit ?? 0),
  });

  useEffect(() => {
    if (open) {
      setV({
        sku: product.sku,
        name: product.name,
        description: (product as any).description ?? "",
        uom: product.uom ?? "EA",
        type: product.type ?? "finished",
        standard_cost: Number((product as any).standard_cost ?? 0),
        sale_price: Number((product as any).sale_price ?? 0),
        lead_time: Number((product as any).lead_time ?? 0),
        batching_limit: Number((product as any).batching_limit ?? 0),
      });
    }
  }, [open, product]);

  const submit = async () => {
    if (!v.sku.trim()) return toast.error("SKU is required");
    if (!v.name.trim()) return toast.error("Name is required");
    if (!(v.sale_price >= 0)) return toast.error("Sale price must be non-negative");
    if (!(v.standard_cost >= 0)) return toast.error("Standard cost must be non-negative");
    if (!Number.isInteger(v.batching_limit) || v.batching_limit < 0) {
      return toast.error("Batching limit must be a non-negative whole number");
    }
    try {
      setBusy(true);
      await onSave({
        sku: v.sku, name: v.name, description: v.description || null,
        uom: v.uom, type: v.type,
        standard_cost: v.standard_cost, sale_price: v.sale_price,
        lead_time: v.lead_time, batching_limit: v.batching_limit,
      } as never);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Field2 label="SKU *"><input value={v.sku} onChange={(e) => setV({ ...v, sku: e.target.value })} className={inputCls} /></Field2>
          <Field2 label="Name *"><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputCls} /></Field2>
          <Field2 label="UOM"><input value={v.uom} onChange={(e) => setV({ ...v, uom: e.target.value })} className={inputCls} /></Field2>
          <Field2 label="Type">
            <select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })} className={inputCls}>
              {productTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field2>
          <Field2 label="Standard cost"><input type="number" min={0} value={v.standard_cost} onChange={(e) => setV({ ...v, standard_cost: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} /></Field2>
          <Field2 label="Sale price"><input type="number" min={0} value={v.sale_price} onChange={(e) => setV({ ...v, sale_price: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} /></Field2>
          <Field2 label="Lead time (days)"><input type="number" min={0} value={v.lead_time} onChange={(e) => setV({ ...v, lead_time: Math.max(0, Number(e.target.value) || 0) })} className={inputCls} /></Field2>
          <Field2 label="Batching limit"><input type="number" min={0} step={1} value={v.batching_limit} onChange={(e) => setV({ ...v, batching_limit: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={inputCls} /></Field2>
          <div className="md:col-span-2">
            <Field2 label="Description"><textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className="mt-1 w-full rounded-lg border border-border/60 bg-card/60 p-2 text-sm" /></Field2>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-lg border border-border/60 px-3 py-1.5 text-xs">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs text-primary disabled:opacity-50">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const inputCls = "mt-1 h-9 w-full rounded-lg border border-border/60 bg-card/60 px-2 text-sm focus:border-primary/50 focus:outline-none";
function Field2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
