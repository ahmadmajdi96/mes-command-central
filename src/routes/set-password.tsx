import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/set-password")({
  head: () => ({ meta: [{ title: "Set password · CORTA OMS" }] }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const { session, loading, user } = useSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (user) {
        await supabase.from("profiles").update({ must_reset_password: false } as never).eq("id", user.id);
      }
      toast.success("Password set");
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl p-8">
        <h1 className="font-display text-2xl font-semibold">Set your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose a new password to continue.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password"
            className="h-10 w-full rounded-lg border border-border/60 bg-card/60 px-3 text-sm" />
          <input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password"
            className="h-10 w-full rounded-lg border border-border/60 bg-card/60 px-3 text-sm" />
          <button type="submit" disabled={busy}
            className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50">
            Set password
          </button>
        </form>
      </div>
    </div>
  );
}
