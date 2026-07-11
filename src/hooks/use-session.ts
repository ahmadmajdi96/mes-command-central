import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/lib/store";

export interface SessionState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roles: Role[];
}

const listeners = new Set<() => void>();
let state: SessionState = { session: null, user: null, loading: true, roles: [] };
const emit = () => listeners.forEach((l) => l());

async function loadRoles(userId: string): Promise<Role[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role as Role);
}

async function refresh(session: Session | null) {
  const roles = session?.user ? await loadRoles(session.user.id) : [];
  state = { session, user: session?.user ?? null, loading: false, roles };
  emit();
}

if (typeof window !== "undefined") {
  supabase.auth.getSession().then(({ data }) => { refresh(data.session); });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
      refresh(session);
    }
  });
}

export function useSession(): SessionState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}
