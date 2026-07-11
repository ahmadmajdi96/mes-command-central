import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { workOrders as seedWO, auditLog as seedAudit, type WorkOrder, type AuditLog } from "./oms-data";

export type FeedEventKind = "wo_start" | "wo_pause" | "wo_resume" | "wo_complete" | "wo_update" | "sop_check" | "sop_uncheck" | "sop_note";
export interface FeedEvent { id: string; at: string; kind: FeedEventKind; message: string; entity?: string; user: string; }

export type Role = "admin" | "order_manager" | "production_planner" | "supervisor" | "operator";
export type SopStep = { id: string; text: string };
export type SopEntry = { stepId: string; done: boolean; notes: string; at?: string };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const initialAudit: AuditLog[] = seedAudit.map((a) => ({ ...a }));
const initialWO: WorkOrder[] = seedWO.map((w) => ({ ...w }));

interface State {
  role: Role;
  currentUser: { id: string; name: string };
  workOrders: WorkOrder[];
  audit: AuditLog[];
  sop: Record<string, SopEntry[]>;
  tick: number;
  live: boolean;
}

const state: State = {
  role: "order_manager",
  currentUser: { id: "U-002", name: "Leila Hariri" },
  workOrders: initialWO,
  audit: initialAudit,
  sop: {},
  tick: 0,
  live: true,
};

const roleUsers: Record<Role, { id: string; name: string }> = {
  admin: { id: "U-001", name: "Faisal Al-Suwailem" },
  order_manager: { id: "U-002", name: "Leila Hariri" },
  production_planner: { id: "U-003", name: "Omar Baroudi" },
  supervisor: { id: "U-004", name: "Sara Khoury" },
  operator: { id: "U-005", name: "Ahmed Fahmy" },
};

const pushAudit = (action: string, entity: string, detail: string) => {
  state.audit = [
    { id: `A-${5000 + state.audit.length}`, at: now(), user: state.currentUser.id, action, entity, detail },
    ...state.audit,
  ];
};

export const store = {
  getState: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setRole: (r: Role) => {
    state.role = r;
    state.currentUser = roleUsers[r];
    emit();
  },
  setLive: (v: boolean) => {
    state.live = v;
    emit();
  },
  updateWO: (id: string, patch: Partial<WorkOrder>, note?: string) => {
    const wo = state.workOrders.find((w) => w.id === id);
    if (!wo) return;
    Object.assign(wo, patch);
    if (note) pushAudit("work_order.update", id, note);
    emit();
  },
  startWO: (id: string) => {
    store.updateWO(id, { status: "in_progress", startedAt: now(), operatorId: state.currentUser.id }, "Started work order");
  },
  pauseWO: (id: string) => {
    store.updateWO(id, { status: "paused" }, "Paused work order");
  },
  resumeWO: (id: string) => {
    store.updateWO(id, { status: "in_progress" }, "Resumed work order");
  },
  completeWO: (id: string) => {
    const wo = state.workOrders.find((w) => w.id === id);
    if (!wo) return;
    store.updateWO(
      id,
      { status: "completed", completedAt: now(), progress: 100, qtyProduced: wo.qtyTarget },
      `Completed: ${wo.qtyTarget} units`,
    );
  },
  toggleSop: (woId: string, step: SopStep) => {
    const list = state.sop[woId] ?? (state.sop[woId] = []);
    const existing = list.find((s) => s.stepId === step.id);
    if (existing) {
      existing.done = !existing.done;
      existing.at = existing.done ? now() : undefined;
    } else {
      list.push({ stepId: step.id, done: true, notes: "", at: now() });
    }
    pushAudit("sop.check", woId, `${existing?.done === false ? "Unchecked" : "Checked"}: ${step.text}`);
    emit();
  },
  setSopNote: (woId: string, stepId: string, notes: string) => {
    const list = state.sop[woId] ?? (state.sop[woId] = []);
    const existing = list.find((s) => s.stepId === stepId);
    if (existing) existing.notes = notes;
    else list.push({ stepId, done: false, notes, at: undefined });
    emit();
  },
  tick: () => {
    if (!state.live) return;
    let changed = false;
    for (const w of state.workOrders) {
      if (w.status === "in_progress" && w.progress < 100) {
        const inc = 1 + Math.floor(Math.random() * 3);
        w.progress = Math.min(100, w.progress + inc);
        w.qtyProduced = Math.min(w.qtyTarget, Math.round((w.qtyTarget * w.progress) / 100));
        w.laborMin += inc * 3;
        changed = true;
      }
    }
    if (changed) {
      state.tick++;
      emit();
    }
  },
};

if (typeof window !== "undefined") {
  // real-time tick simulator
  setInterval(() => store.tick(), 4000);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export const sopStepsFor = (operation: string): SopStep[] => {
  const key = operation.toLowerCase();
  const table: Record<string, SopStep[]> = {
    casting: [
      { id: "safety", text: "Don PPE: heat suit, face shield, gloves" },
      { id: "temp", text: "Verify pouring temperature reaches spec (±20°C)" },
      { id: "pour", text: "Pour metal into mold following ladle path" },
      { id: "cool", text: "Cool for minimum required hold time before demold" },
      { id: "inspect", text: "Visual inspection for cracks, porosity, cold shuts" },
      { id: "log", text: "Record heat number and MTR against WO" },
    ],
    "rough machining": [
      { id: "setup", text: "Load casting on fixture, indicate <0.05mm" },
      { id: "program", text: "Load NC program per drawing revision" },
      { id: "face", text: "Face body and bore seat pocket to spec" },
      { id: "gauge", text: "First-off inspection with CMM" },
      { id: "signoff", text: "QA sign-off before batch run" },
    ],
    "precision machining": [
      { id: "setup", text: "Center-align workpiece within 0.02mm TIR" },
      { id: "tools", text: "Verify tool offsets and coolant flow" },
      { id: "run", text: "Run finishing pass; monitor surface finish Ra" },
      { id: "balance", text: "Balance impeller to ISO G2.5" },
      { id: "inspect", text: "CMM inspection against drawing tolerances" },
    ],
    "weld attachments": [
      { id: "prep", text: "Clean weld area, apply preheat to 120°C" },
      { id: "tack", text: "Tack weld and verify fit-up" },
      { id: "weld", text: "TIG weld per WPS with correct filler" },
      { id: "test", text: "Dye-penetrant inspection of weld joints" },
    ],
    "motor assembly": [
      { id: "mount", text: "Mount 45kW motor to bedplate" },
      { id: "align", text: "Laser-align coupling to <0.05mm" },
      { id: "wire", text: "Wire motor per electrical drawing" },
      { id: "test", text: "No-load run test 5 minutes" },
    ],
    assembly: [
      { id: "stem", text: "Fit stem, gland packing, and hand-wheel" },
      { id: "torque", text: "Torque bolts to spec (220 Nm)" },
      { id: "seal", text: "Apply thread sealant to all NPT joints" },
      { id: "operate", text: "Cycle valve/pump 3 times; verify smooth operation" },
    ],
    "hydro test": [
      { id: "fill", text: "Fill with water, purge air" },
      { id: "pressure", text: "Pressurize to 1.5x rating for 3 minutes" },
      { id: "seat", text: "Verify seat leakage class VI" },
      { id: "drain", text: "Drain, dry, apply preservative" },
    ],
    "performance test": [
      { id: "setup", text: "Mount on test rig, connect instrumentation" },
      { id: "curve", text: "Record head/flow curve at 5 points" },
      { id: "vibration", text: "Measure vibration; verify <2.5 mm/s" },
      { id: "report", text: "Generate test report and sign" },
    ],
    "pack & label": [
      { id: "protect", text: "Wrap flange faces with protective covers" },
      { id: "crate", text: "Place in crate with foam/skid" },
      { id: "label", text: "Apply MTR, tag, and shipping label" },
      { id: "photo", text: "Take photo of packed unit for records" },
    ],
    crating: [
      { id: "skid", text: "Position on shipping skid" },
      { id: "wrap", text: "Shrink-wrap for weather protection" },
      { id: "lift", text: "Attach lifting eyes and lashing points" },
      { id: "manifest", text: "Complete shipping manifest" },
    ],
  };
  return (
    table[key] ?? [
      { id: "prepare", text: "Prepare workstation and review drawings" },
      { id: "execute", text: "Execute operation per SOP" },
      { id: "inspect", text: "Perform in-process inspection" },
      { id: "log", text: "Log output quantity and any deviations" },
    ]
  );
};
