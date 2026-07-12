import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

type T = Database["public"]["Tables"];
export type IntegrationSetting = T["integration_settings"]["Row"];
export type QcInspection = T["qc_inspections"]["Row"];
export type NonConformance = T["non_conformances"]["Row"];
export type DowntimeEvent = T["downtime_events"]["Row"];
export type StationStatus = T["station_status"]["Row"];
export type KpiSnapshot = T["kpi_snapshots"]["Row"];
export type IntegrationEvent = T["integration_events"]["Row"];

export type SisterSystem = "mes" | "qc" | "command_center";

/* ------------------------- Integration settings ------------------------- */
export const integrationSettingsKey = ["integration_settings"] as const;

export function useIntegrationSettings() {
  const { user } = useSession();
  return useQuery({
    queryKey: [...integrationSettingsKey, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<IntegrationSetting[]> => {
      const { data, error } = await supabase.from("integration_settings").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertIntegrationSetting() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async (input: { system: SisterSystem; base_url?: string | null; enabled?: boolean }) => {
      if (!user) throw new Error("Sign in required");
      const { data, error } = await supabase
        .from("integration_settings")
        .upsert({ user_id: user.id, ...input }, { onConflict: "user_id,system" })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: integrationSettingsKey });
      toast.success("Integration settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarkSync() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ system, status }: { system: SisterSystem; status: string }) => {
      if (!user) return;
      await supabase.from("integration_settings")
        .update({ last_sync_at: new Date().toISOString(), last_status: status })
        .eq("user_id", user.id).eq("system", system);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationSettingsKey }),
  });
}

/* ------------------------------- QC ------------------------------------ */
export const qcKey = ["qc_inspections"] as const;
export function useQcInspections() {
  return useQuery({
    queryKey: qcKey,
    queryFn: async (): Promise<QcInspection[]> => {
      const { data, error } = await supabase.from("qc_inspections").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateQcInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<QcInspection>) => {
      const { data, error } = await supabase.from("qc_inspections").insert(input as never).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qcKey }); toast.success("Inspection recorded"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateQcInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<QcInspection> }) => {
      const { data, error } = await supabase.from("qc_inspections").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qcKey }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ----------------------------- NCRs ----------------------------------- */
export const ncrKey = ["non_conformances"] as const;
export function useNonConformances() {
  return useQuery({
    queryKey: ncrKey,
    queryFn: async (): Promise<NonConformance[]> => {
      const { data, error } = await supabase.from("non_conformances").select("*").order("raised_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateNcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<NonConformance> & { number: string }) => {
      const { data, error } = await supabase.from("non_conformances").insert(input as never).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ncrKey }); toast.success("NCR raised"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateNcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<NonConformance> }) => {
      const { data, error } = await supabase.from("non_conformances").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ncrKey }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* --------------------------- Downtime --------------------------------- */
export const downtimeKey = ["downtime_events"] as const;
export function useDowntimeEvents() {
  return useQuery({
    queryKey: downtimeKey,
    queryFn: async (): Promise<DowntimeEvent[]> => {
      const { data, error } = await supabase.from("downtime_events").select("*").order("started_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateDowntime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<DowntimeEvent> & { reason: string }) => {
      const { data, error } = await supabase.from("downtime_events").insert(input as never).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: downtimeKey }); toast.success("Downtime logged"); },
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------- Station status ----------------------------- */
export const stationsKey = ["station_status"] as const;
export function useStationStatuses() {
  return useQuery({
    queryKey: stationsKey,
    queryFn: async (): Promise<StationStatus[]> => {
      const { data, error } = await supabase.from("station_status").select("*").order("station_code");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertStation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<StationStatus> & { station_code: string; name: string }) => {
      const { data, error } = await supabase.from("station_status")
        .upsert(input as never, { onConflict: "station_code" })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: stationsKey }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------------ KPIs ---------------------------------- */
export const kpiKey = ["kpi_snapshots"] as const;
export function useKpiSnapshots(source?: string) {
  return useQuery({
    queryKey: [...kpiKey, source ?? "all"],
    queryFn: async (): Promise<KpiSnapshot[]> => {
      let q = supabase.from("kpi_snapshots").select("*").order("captured_at", { ascending: false }).limit(200);
      if (source) q = q.eq("source", source);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRecordKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<KpiSnapshot> & { source: string; metric: string; value: number }) => {
      const { data, error } = await supabase.from("kpi_snapshots").insert(input as never).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: kpiKey }),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------- Integration events ------------------------- */
export function useIntegrationEvents() {
  return useQuery({
    queryKey: ["integration_events"],
    queryFn: async (): Promise<IntegrationEvent[]> => {
      const { data, error } = await supabase.from("integration_events").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}
