import { Link } from "@tanstack/react-router";
import { LogOut, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession, signOut } from "@/hooks/use-session";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function UserMenu() {
  const { user, loading } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || loading) return <div className="h-9 w-9" aria-hidden />;
  if (!user) {
    return (
      <Link to="/auth"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-medium text-primary hover:bg-primary/20">
        Sign in
      </Link>
    );
  }
  const initials = (user.email ?? "?").slice(0, 2).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-2 text-xs hover:bg-card">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 font-mono text-[10px] text-primary">{initials}</span>
          <span className="hidden font-mono sm:inline">{user.email}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">
          <div className="font-medium">{(user.user_metadata?.name as string) || "Signed in"}</div>
          <div className="font-mono text-[10px] text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings" className="cursor-pointer"><UserIcon className="mr-2 h-3.5 w-3.5" /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={async () => { await signOut(); toast.success("Signed out"); }} className="cursor-pointer">
          <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
