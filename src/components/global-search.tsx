import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, ShoppingCart, UserCircle, Package, Factory, Truck } from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { salesOrders, customers, products, productionOrders, shipments, findCustomer, findProduct } from "@/lib/oms-data";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();


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
        <CommandInput placeholder="Search orders, customers, products, work orders…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Sales Orders">
            {salesOrders.map((o) => (
              <CommandItem key={o.id} value={`${o.number} ${findCustomer(o.customerId)?.name}`}
                onSelect={() => go(`/orders/${o.id}`)}>
                <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs">{o.number}</span>
                <span className="text-xs text-muted-foreground">· {findCustomer(o.customerId)?.name}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">${o.total.toLocaleString()}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Customers">
            {customers.map((c) => (
              <CommandItem key={c.id} value={`${c.id} ${c.name} ${c.contact}`}
                onSelect={() => go(`/customers/${c.id}`)}>
                <UserCircle className="h-3.5 w-3.5 text-info" />
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">· {c.contact}</span>
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
            {productionOrders.map((p) => (
              <CommandItem key={p.id} value={`${p.number} ${findProduct(p.productId)?.name}`}
                onSelect={() => go(`/production-orders/${p.id}`)}>
                <Factory className="h-3.5 w-3.5 text-info" />
                <span className="font-mono text-xs">{p.number}</span>
                <span className="text-xs">· {findProduct(p.productId)?.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Shipments">
            {shipments.map((s) => (
              <CommandItem key={s.id} value={`${s.number} ${s.carrier}`}
                onSelect={() => go("/shipments")}>
                <Truck className="h-3.5 w-3.5 text-success" />
                <span className="font-mono text-xs">{s.number}</span>
                <span className="text-xs text-muted-foreground">· {s.carrier}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
