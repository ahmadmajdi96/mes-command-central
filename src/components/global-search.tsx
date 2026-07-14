import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, ShoppingCart, UserCircle, Package, Factory, Truck, Boxes } from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { useOrders, useCustomers, useProducts, useShipments } from "@/lib/oms-db";
import { useProductionOrders } from "@/lib/production-orders-db";
import { useBatches } from "@/lib/batches-db";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: orders = [] } = useOrders();
  const { data: customers = [] } = useCustomers();
  const { data: products = [] } = useProducts();
  const { data: shipments = [] } = useShipments();
  const { data: pos = [] } = useProductionOrders();
  const { data: batches = [] } = useBatches();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to });
  };

  const findCustomer = (id: string | null) => customers.find((c) => c.id === id);
  const findProduct = (id: string | null) => products.find((p) => p.id === id);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative hidden h-9 w-72 items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 text-left text-sm text-muted-foreground/70 hover:text-foreground md:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 truncate">Search everywhere…</span>
        <kbd className="rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground md:hidden"
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search orders, customers, products, batches…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Sales Orders">
            {orders.slice(0, 30).map((o) => (
              <CommandItem key={o.id} value={`${o.number} ${findCustomer(o.customer_id)?.name ?? ""}`}
                onSelect={() => go(`/orders/${o.id}`)}>
                <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs">{o.number}</span>
                <span className="text-xs text-muted-foreground">· {findCustomer(o.customer_id)?.name ?? "—"}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">${Number(o.total ?? 0).toLocaleString()}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Customers">
            {customers.map((c) => (
              <CommandItem key={c.id} value={`${c.code ?? ""} ${c.name} ${c.contact ?? ""}`}
                onSelect={() => go(`/customers/${c.id}`)}>
                <UserCircle className="h-3.5 w-3.5 text-info" />
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">· {c.contact ?? ""}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Products">
            {products.map((p) => (
              <CommandItem key={p.id} value={`${p.sku} ${p.name}`}
                onSelect={() => go(`/products/${p.id}`)}>
                <Package className="h-3.5 w-3.5 text-accent" />
                <span className="font-mono text-xs">{p.sku}</span>
                <span className="text-xs">{p.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Production Orders">
            {pos.slice(0, 30).map((p) => (
              <CommandItem key={p.id} value={`${p.number ?? ""} ${findProduct(p.product_id)?.name ?? ""}`}
                onSelect={() => go(`/production-orders/${p.id}`)}>
                <Factory className="h-3.5 w-3.5 text-info" />
                <span className="font-mono text-xs">{p.number}</span>
                <span className="text-xs">· {findProduct(p.product_id)?.name ?? "—"}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Batches">
            {batches.slice(0, 30).map((b) => (
              <CommandItem key={b.id} value={`${b.number ?? ""} ${b.lot_code ?? ""}`}
                onSelect={() => go(`/batches/${b.id}`)}>
                <Boxes className="h-3.5 w-3.5 text-accent" />
                <span className="font-mono text-xs">{b.number}</span>
                <span className="text-xs text-muted-foreground">· {b.lot_code ?? "—"}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Shipments">
            {shipments.slice(0, 30).map((s) => (
              <CommandItem key={s.id} value={`${s.number} ${s.carrier ?? ""}`}
                onSelect={() => go("/shipments")}>
                <Truck className="h-3.5 w-3.5 text-success" />
                <span className="font-mono text-xs">{s.number}</span>
                <span className="text-xs text-muted-foreground">· {s.carrier ?? ""}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
