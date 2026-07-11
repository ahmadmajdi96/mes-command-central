import { ShieldCheck } from "lucide-react";
import { useStore, store, type Role } from "@/lib/store";
import { roleLabels } from "@/lib/roles";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const roles: Role[] = ["admin", "order_manager", "production_planner", "supervisor", "operator"];

export function RoleSwitcher() {
  const role = useStore((s) => s.role);
  const user = useStore((s) => s.currentUser);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2 py-1 hover:bg-card">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-primary to-info text-[10px] font-bold text-primary-foreground">
            {user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="hidden text-xs leading-tight sm:block">
            <div className="font-medium">{user.name}</div>
            <div className="text-[10px] text-muted-foreground">{roleLabels[role]}</div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Switch role (demo)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((r) => (
          <DropdownMenuItem key={r} onSelect={() => store.setRole(r)} className="gap-2">
            <ShieldCheck className={`h-3.5 w-3.5 ${r === role ? "text-primary" : "text-muted-foreground"}`} />
            <span className={r === role ? "font-medium text-primary" : ""}>{roleLabels[r]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
