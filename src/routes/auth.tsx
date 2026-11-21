import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { OMSThemeToggle } from "@/components/oms-appearance";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · MANUQUBE OMS" },
      {
        name: "description",
        content: "Sign in to MANUQUBE OMS to access your authorized operational workspace.",
      },
      { property: "og:title", content: "Sign in · MANUQUBE OMS" },
      {
        property: "og:description",
        content: "Sign in to MANUQUBE OMS to access your authorized operational workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Signed in");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-2">
        <aside className="oms-brand-stage relative isolate flex min-h-36 items-end overflow-hidden p-5 md:min-h-[31rem] md:p-8">
          <img
            src="/brand/dispatcher.webp"
            alt=""
            width={720}
            height={958}
            className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_30%]"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-graphite via-graphite/50 to-transparent" />
          <div>
            <p className="text-3xl font-semibold text-dispatcher">Dispatcher</p>
            <p className="mt-1 text-sm text-ivory">Make the delivery promise match the plan.</p>
          </div>
        </aside>
        <div className="self-center p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link
              to="/"
              className="mb-6 inline-block font-display text-lg font-semibold tracking-tight"
            >
              CORTA OMS
            </Link>
            <OMSThemeToggle />
          </div>
          <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace</p>

          <div className="mt-6" />

          <form onSubmit={submit} className="space-y-3">
            <input
              aria-label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="h-10 w-full rounded-lg border border-border/60 bg-card/60 px-3 text-sm focus:border-primary/50 focus:outline-none"
            />
            <input
              aria-label="Password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="h-10 w-full rounded-lg border border-border/60 bg-card/60 px-3 text-sm focus:border-primary/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Accounts are created by an administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
