import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { GlobalSearch } from "@/components/global-search";

import { LiveIndicator } from "@/components/live-indicator";
import { EventFeed } from "@/components/event-feed";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell } from "@/components/notification-bell";
import { useSession } from "@/hooks/use-session";
import { useNotificationsRealtime } from "@/lib/notifications-db";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CORTA OMS — Manufacturing Order Management" },
      { name: "description", content: "Universal order management for manufacturing: sales orders, production planning, shop-floor execution, inventory and fulfilment." },
      { property: "og:title", content: "CORTA OMS — Manufacturing Order Management" },
      { property: "og:description", content: "Sales orders, production planning, shop-floor execution, inventory and fulfilment in one system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function TopBar() {
  const { user } = useSession();
  useNotificationsRealtime(user?.id);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <span>Plant 01 · Riyadh</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Order Operations</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <LiveIndicator />
        <GlobalSearch />
        <NotificationBell />
        <EventFeed />
        <UserMenu />
      </div>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { session, loading } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isAuthRoute = pathname === "/auth" || pathname === "/set-password";

  useEffect(() => {
    if (!loading && !session && !isAuthRoute) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, session, isAuthRoute, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.from("profiles").select("must_reset_password").eq("id", session.user.id).maybeSingle().then(({ data }) => {
        if (!cancelled && data?.must_reset_password && pathname !== "/set-password") {
          navigate({ to: "/set-password", replace: true });
        }
      })
    );
    return () => { cancelled = true; };
  }, [session?.user, pathname, navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      {isAuthRoute ? (
        <Outlet />
      ) : !session ? (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-sm text-muted-foreground">
            {loading ? "Loading…" : "Redirecting to sign in…"}
          </div>
        </div>
      ) : (
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="flex-1 p-4 sm:p-6">
                <Outlet />
              </main>
            </div>
          </div>
        </SidebarProvider>
      )}
      <Toaster theme="dark" position="bottom-right" richColors />
    </QueryClientProvider>
  );
}

