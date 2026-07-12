/**
 * Outbound HTTP client for sister systems (MES / QC / Command Center).
 * Each user configures the base URL of the sister app in Settings; this client
 * fetches JSON from a well-known path on that origin and gracefully returns
 * `{ ok: false }` when unreachable so hub pages fall back to local data.
 */

import type { SisterSystem } from "./integrations-db";

export type Fetched<T> = { ok: true; data: T } | { ok: false; error: string };

const PATHS: Record<SisterSystem, { list: string; label: string }> = {
  mes:            { list: "/api/public/stations",    label: "MES Command Center" },
  qc:             { list: "/api/public/inspections", label: "CORTA QC System" },
  command_center: { list: "/api/public/kpis",        label: "Command Center Pro" },
};

export function sisterLabel(s: SisterSystem) { return PATHS[s].label; }

export async function fetchFromSister<T>(system: SisterSystem, baseUrl: string, path?: string): Promise<Fetched<T>> {
  if (!baseUrl) return { ok: false, error: "No base URL configured" };
  const url = baseUrl.replace(/\/+$/, "") + (path ?? PATHS[system].list);
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, mode: "cors" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Fire-and-forget outbound push (webhook) to sister system. */
export async function pushToSister(baseUrl: string, event: unknown): Promise<Fetched<unknown>> {
  if (!baseUrl) return { ok: false, error: "No base URL configured" };
  const url = baseUrl.replace(/\/+$/, "") + "/api/public/webhooks/oms";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      mode: "cors",
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, data: await res.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}
