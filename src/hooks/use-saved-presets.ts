import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

export interface Preset<T = Record<string, unknown>> {
  id: string;
  name: string;
  payload: T;
  is_default: boolean;
}

const LS_KEY = (page: string) => `oms:presets:${page}`;

/**
 * Saved filter presets, per user per page.
 * Signed in → syncs to backend (saved_filter_presets table).
 * Signed out → localStorage fallback.
 */
export function useSavedPresets<T extends Record<string, unknown>>(pageKey: string, current: T) {
  const { user } = useSession();
  const [presets, setPresets] = useState<Preset<T>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    if (user) {
      const { data, error } = await supabase
        .from("saved_filter_presets")
        .select("id, name, payload, is_default")
        .eq("page_key", pageKey)
        .order("created_at", { ascending: true });
      if (error) console.error(error);
      setPresets((data ?? []) as Preset<T>[]);
    } else if (typeof window !== "undefined") {
      const raw = localStorage.getItem(LS_KEY(pageKey));
      setPresets(raw ? (JSON.parse(raw) as Preset<T>[]) : []);
    }
    setLoading(false);
  }, [user, pageKey]);

  useEffect(() => { load(); }, [load]);

  const persistLocal = (next: Preset<T>[]) => {
    setPresets(next);
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY(pageKey), JSON.stringify(next));
  };

  const save = async (name: string) => {
    if (!name.trim()) return;
    if (user) {
      const { data, error } = await supabase.from("saved_filter_presets")
        .upsert({ user_id: user.id, page_key: pageKey, name, payload: current as never }, { onConflict: "user_id,page_key,name" })
        .select("id, name, payload, is_default").single();
      if (error) { toast.error(error.message); return; }
      setPresets((p) => {
        const others = p.filter((x) => x.name !== name);
        return [...others, data as Preset<T>];
      });
      toast.success(`Saved preset "${name}"`);
    } else {
      const next = presets.filter((p) => p.name !== name);
      next.push({ id: crypto.randomUUID(), name, payload: current, is_default: false });
      persistLocal(next);
      toast.success(`Saved preset "${name}" (local)`);
    }
  };

  const remove = async (id: string) => {
    if (user) {
      await supabase.from("saved_filter_presets").delete().eq("id", id);
    }
    persistLocal(presets.filter((p) => p.id !== id));
  };

  return { presets, loading, save, remove };
}
