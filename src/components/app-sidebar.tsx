import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Package,
  
  Truck,
  UserCircle,
  Settings,
  History,
  Gauge,
  Send,
  Boxes,
} from "lucide-react";


import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const overview = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
];

const orders = [
  { title: "Sales Orders", url: "/orders", icon: ShoppingCart },
  { title: "Customers", url: "/customers", icon: UserCircle },
  { title: "Shipments", url: "/shipments", icon: Truck },
];

const production = [
  { title: "Production Orders", url: "/production-orders", icon: Factory },
  { title: "Batches", url: "/batches", icon: Boxes },
];


const integrations = [
  { title: "Requests", url: "/requests", icon: Send },
];


const materials = [
  { title: "Products", url: "/products", icon: Package },
];


const platform = [
  { title: "Audit Log", url: "/audit", icon: History },
  { title: "Settings", url: "/settings", icon: Settings },
];


export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

  const renderGroup = (label: string, items: typeof overview) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:border data-[active=true]:border-primary/30 rounded-lg h-10"
                >
                  <Link to={item.url} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-[var(--shadow-glow)]">
            <Factory className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">CORTA OMS</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              FACTORY FLOOR · V1.0
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-2">
        {renderGroup("Overview", overview)}
        {renderGroup("Orders", orders)}
        {renderGroup("Production", production)}
        {renderGroup("Integrations", integrations)}
        {renderGroup("Materials", materials)}
        {renderGroup("Platform", platform)}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-xs">
            <span className="status-dot animate-pulse-glow text-success" />
            <span className="font-medium">API healthy · v1.0</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Plant 01 · 8 workstations online
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
