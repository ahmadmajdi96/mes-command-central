import { describe, expect, it } from "vitest";
import { mapHubPermissions, viewOnlyMatrix } from "./access-hub-map";
import { isPlanStale } from "./aps-plan";
import { capaCloseBlockers, isCapaOverdue } from "./quality-db";

const p = (resource_key: string, v = false, c = false, e = false, d = false) => ({ resource_key, can_view: v, can_create: c, can_edit: e, can_delete: d });

describe("Command Access Hub mapping", () => {
  it("maps Hub view/create/edit/delete to read/create/update/delete", () => {
    expect(mapHubPermissions([p("orders", true, true, true, false)]).orders).toEqual({ read: true, create: true, update: true, delete: false });
  });
  it("converts dashed and -detail keys to local resources", () => {
    const m = mapHubPermissions([p("production-orders-detail", true)]);
    expect(m.production_orders?.read).toBe(true);
  });
  it("grants nothing for unknown Hub keys", () => {
    expect(mapHubPermissions([p("schedule", true, true, true, true)])).toEqual({});
  });
  it("feature keys grant one action on their resource", () => {
    const m = mapHubPermissions([p("pick-fulfillment", true)]);
    expect(m.fulfillments).toEqual({ read: true, create: false, update: true, delete: false });
  });
  it("fail-closed fallback can view everything and change nothing", () => {
    const m = viewOnlyMatrix();
    expect(Object.values(m).every((a) => a.read && !a.create && !a.update && !a.delete)).toBe(true);
  });
});

describe("APS plan staleness", () => {
  it("is stale when the order revision moved past the approved plan", () => {
    expect(isPlanStale({ aps_schedule_version: "SV1", aps_plan_revision: 1, revision: 2, status: "released" })).toBe(true);
  });
  it("is not stale for the same revision", () => {
    expect(isPlanStale({ aps_schedule_version: "SV1", aps_plan_revision: 2, revision: 2, status: "released" })).toBe(false);
  });
});

describe("CAPA close rule", () => {
  const ok = { root_cause: "Worn seal", effectiveness_check: "30 days no leaks", effectiveness_verified: true };
  it("closes only with root cause, all actions done and verified effectiveness", () => {
    expect(capaCloseBlockers(ok, [{ done: true }])).toEqual([]);
  });
  it("blocks when an action is still open", () => {
    expect(capaCloseBlockers(ok, [{ done: true }, { done: false }])).toContain("Finish every action");
  });
  it("blocks without any action", () => {
    expect(capaCloseBlockers(ok, [])).toContain("Add at least one action");
  });
  it("blocks when effectiveness isn't verified", () => {
    expect(capaCloseBlockers({ ...ok, effectiveness_verified: false }, [{ done: true }])).toContain("Verify effectiveness");
  });
  it("is overdue after its due date unless closed", () => {
    const now = new Date("2026-11-05T10:00:00Z");
    expect(isCapaOverdue({ status: "open", due_date: "2026-11-01" }, now)).toBe(true);
    expect(isCapaOverdue({ status: "closed", due_date: "2026-11-01" }, now)).toBe(false);
  });
});
