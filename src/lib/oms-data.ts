// Seed data for CORTA OMS demo
export type SalesOrderStatus = "draft" | "confirmed" | "in_production" | "partially_shipped" | "shipped" | "cancelled";
export type ProductionOrderStatus = "planned" | "released" | "in_progress" | "completed" | "cancelled";
export type WorkOrderStatus = "pending" | "in_progress" | "paused" | "completed" | "cancelled";

export interface Customer {
  id: string; name: string; contact: string; email: string; phone: string; address: string; createdAt: string;
}
export interface Product {
  id: string; sku: string; name: string; description: string; uom: string; type: "finished" | "raw" | "semi";
  standardCost: number; leadTime: number;
}
export interface Workstation { id: string; name: string; type: string; capacity: number; status: "active" | "maintenance" | "offline"; }
export interface BOMLine { componentId: string; qty: number; scrapPct: number; }
export interface RoutingStep { seq: number; workstationId: string; operation: string; setupMin: number; runMin: number; instructions: string; }
export interface SalesOrderLine { id: string; productId: string; qty: number; unitPrice: number; dueDate: string; status: "pending" | "in_production" | "shipped"; }
export interface SalesOrder {
  id: string; number: string; customerId: string; status: SalesOrderStatus;
  orderDate: string; dueDate: string; total: number; currency: string;
  notes?: string; lines: SalesOrderLine[]; createdBy: string;
}
export interface ProductionOrder {
  id: string; number: string; salesOrderId?: string; productId: string; qty: number;
  status: ProductionOrderStatus; priority: number; plannedStart: string; plannedEnd: string;
  actualStart?: string; actualEnd?: string; qtyProduced: number; qtyScrap: number;
}
export interface WorkOrder {
  id: string; number: string; productionOrderId: string; seq: number; operation: string;
  workstationId: string; status: WorkOrderStatus; operatorId?: string;
  qtyTarget: number; qtyProduced: number; qtyScrap: number; startedAt?: string; completedAt?: string;
  laborMin: number; progress: number;
}
export interface InventoryLine {
  productId: string; workstationId: string | null; qty: number; reserved: number; updated: string;
}
export interface InventoryTxn { id: string; productId: string; type: "receipt" | "issue" | "adjust" | "transfer"; qty: number; ref: string; at: string; user: string; }
export interface Shipment { id: string; number: string; salesOrderId: string; carrier: string; tracking: string; status: "draft" | "packed" | "shipped" | "delivered"; shippedAt?: string; }
export interface User { id: string; username: string; fullName: string; email: string; role: "admin" | "order_manager" | "production_planner" | "supervisor" | "operator"; active: boolean; }
export interface AuditLog { id: string; at: string; user: string; action: string; entity: string; detail: string; }

export const customers: Customer[] = [
  { id: "CUS-001", name: "Aramco Refining", contact: "Khalid Al-Otaibi", email: "k.otaibi@aramco.com", phone: "+966 11 500 1200", address: "Dhahran, KSA", createdAt: "2026-01-14" },
  { id: "CUS-002", name: "SABIC Polymers", contact: "Nora Al-Ghamdi", email: "n.ghamdi@sabic.com", phone: "+966 13 320 9800", address: "Jubail, KSA", createdAt: "2026-02-02" },
  { id: "CUS-003", name: "Ma'aden Aluminum", contact: "Bassam Alqahtani", email: "b.alqahtani@maaden.com", phone: "+966 12 610 4400", address: "Ras Al-Khair, KSA", createdAt: "2026-02-19" },
  { id: "CUS-004", name: "Siemens Energy ME", contact: "Julia Bergmann", email: "j.bergmann@siemens.com", phone: "+971 4 405 8800", address: "Dubai, UAE", createdAt: "2026-03-05" },
  { id: "CUS-005", name: "NEOM Industrial", contact: "Amelia Novak", email: "a.novak@neom.com", phone: "+966 12 900 1010", address: "Tabuk, KSA", createdAt: "2026-04-22" },
  { id: "CUS-006", name: "ADNOC Downstream", contact: "Yusuf Al-Hashimi", email: "y.hashimi@adnoc.ae", phone: "+971 2 707 0000", address: "Ruwais, UAE", createdAt: "2026-05-10" },
];

export const products: Product[] = [
  { id: "P-1001", sku: "VLV-8-CS", name: '8" Cast-Steel Gate Valve', description: 'ANSI Class 300 gate valve, cast steel body, flanged.', uom: "EA", type: "finished", standardCost: 1240, leadTime: 14 },
  { id: "P-1002", sku: "PMP-CX-45", name: "Centrifugal Pump CX-45", description: "45 kW industrial centrifugal pump.", uom: "EA", type: "finished", standardCost: 3850, leadTime: 21 },
  { id: "P-1003", sku: "PIP-6-SS", name: '6" SS Pipe Spool 3m', description: '316L stainless spool, beveled ends.', uom: "EA", type: "finished", standardCost: 480, leadTime: 7 },
  { id: "P-1004", sku: "FLG-8-300", name: '8" WN Flange Class 300', description: "Weld-neck flange, RF face.", uom: "EA", type: "semi", standardCost: 92, leadTime: 5 },
  { id: "P-2001", sku: "RAW-CS-INGOT", name: "Cast Steel Ingot 500kg", description: "Foundry-grade ingot.", uom: "KG", type: "raw", standardCost: 1.8, leadTime: 3 },
  { id: "P-2002", sku: "RAW-SS-316L", name: "316L Stainless Billet", description: "Round billet Ø200mm.", uom: "KG", type: "raw", standardCost: 4.6, leadTime: 5 },
  { id: "P-2003", sku: "RAW-BOLT-M20", name: "M20 x 100 Bolt Set", description: "Grade 8.8 with nut & washer.", uom: "SET", type: "raw", standardCost: 3.2, leadTime: 2 },
];

export const workstations: Workstation[] = [
  { id: "WS-01", name: "Foundry Bay A", type: "Casting", capacity: 12, status: "active" },
  { id: "WS-02", name: "CNC Cell 1", type: "Machining", capacity: 8, status: "active" },
  { id: "WS-03", name: "CNC Cell 2", type: "Machining", capacity: 8, status: "active" },
  { id: "WS-04", name: "Welding Booth", type: "Welding", capacity: 6, status: "active" },
  { id: "WS-05", name: "Assembly Line 1", type: "Assembly", capacity: 20, status: "active" },
  { id: "WS-06", name: "Hydrostatic Test", type: "QA", capacity: 4, status: "active" },
  { id: "WS-07", name: "Paint & Coat", type: "Finishing", capacity: 10, status: "maintenance" },
  { id: "WS-08", name: "Packing Station", type: "Packaging", capacity: 15, status: "active" },
];

export const boms: Record<string, BOMLine[]> = {
  "P-1001": [
    { componentId: "P-2001", qty: 45, scrapPct: 3 },
    { componentId: "P-1004", qty: 2, scrapPct: 1 },
    { componentId: "P-2003", qty: 12, scrapPct: 0 },
  ],
  "P-1002": [
    { componentId: "P-2001", qty: 180, scrapPct: 4 },
    { componentId: "P-2002", qty: 40, scrapPct: 2 },
    { componentId: "P-2003", qty: 24, scrapPct: 0 },
  ],
  "P-1003": [{ componentId: "P-2002", qty: 22, scrapPct: 2 }],
  "P-1004": [{ componentId: "P-2001", qty: 8, scrapPct: 3 }],
};

export const routings: Record<string, RoutingStep[]> = {
  "P-1001": [
    { seq: 10, workstationId: "WS-01", operation: "Casting", setupMin: 30, runMin: 180, instructions: "Pour cast steel at 1580°C. Cool 4h before demold." },
    { seq: 20, workstationId: "WS-02", operation: "Rough Machining", setupMin: 15, runMin: 90, instructions: "Face body, bore seat pocket per drawing V-8-CS-01." },
    { seq: 30, workstationId: "WS-04", operation: "Weld Attachments", setupMin: 10, runMin: 45, instructions: "TIG weld bonnet flange. Preheat 120°C." },
    { seq: 40, workstationId: "WS-05", operation: "Assembly", setupMin: 5, runMin: 40, instructions: "Fit stem, gland, and hand-wheel. Torque bolts to 220 Nm." },
    { seq: 50, workstationId: "WS-06", operation: "Hydro Test", setupMin: 5, runMin: 20, instructions: "Test at 1.5x rating for 3 min. Log seat leak class VI." },
    { seq: 60, workstationId: "WS-08", operation: "Pack & Label", setupMin: 5, runMin: 15, instructions: "Wrap flange faces, crate, apply MTR label." },
  ],
  "P-1002": [
    { seq: 10, workstationId: "WS-01", operation: "Casting", setupMin: 40, runMin: 240, instructions: "Casing + impeller in matched heat." },
    { seq: 20, workstationId: "WS-03", operation: "Precision Machining", setupMin: 25, runMin: 180, instructions: "Balance impeller to ISO G2.5." },
    { seq: 30, workstationId: "WS-05", operation: "Motor Assembly", setupMin: 10, runMin: 120, instructions: "Fit 45 kW motor, align coupling <0.05mm." },
    { seq: 40, workstationId: "WS-06", operation: "Performance Test", setupMin: 15, runMin: 60, instructions: "Record head/flow curve. Vibration <2.5 mm/s." },
    { seq: 50, workstationId: "WS-08", operation: "Crating", setupMin: 5, runMin: 30, instructions: "Skid, shrink-wrap, add lifting eyes." },
  ],
};

export const salesOrders: SalesOrder[] = [
  {
    id: "SO-2026-0142", number: "SO-2026-0142", customerId: "CUS-001", status: "in_production",
    orderDate: "2026-06-14", dueDate: "2026-07-28", total: 148800, currency: "USD",
    notes: "Priority — Refinery unit 4 turnaround.",
    createdBy: "Order Manager",
    lines: [
      { id: "L1", productId: "P-1001", qty: 60, unitPrice: 1620, dueDate: "2026-07-25", status: "in_production" },
      { id: "L2", productId: "P-1003", qty: 120, unitPrice: 435, dueDate: "2026-07-28", status: "pending" },
    ],
  },
  {
    id: "SO-2026-0143", number: "SO-2026-0143", customerId: "CUS-002", status: "confirmed",
    orderDate: "2026-06-18", dueDate: "2026-08-02", total: 92400, currency: "USD",
    createdBy: "Order Manager",
    lines: [
      { id: "L1", productId: "P-1002", qty: 20, unitPrice: 4620, dueDate: "2026-08-02", status: "pending" },
    ],
  },
  {
    id: "SO-2026-0144", number: "SO-2026-0144", customerId: "CUS-003", status: "shipped",
    orderDate: "2026-05-30", dueDate: "2026-07-05", total: 55440, currency: "USD",
    createdBy: "Order Manager",
    lines: [
      { id: "L1", productId: "P-1003", qty: 96, unitPrice: 465, dueDate: "2026-07-05", status: "shipped" },
      { id: "L2", productId: "P-1004", qty: 120, unitPrice: 92, dueDate: "2026-07-05", status: "shipped" },
    ],
  },
  {
    id: "SO-2026-0145", number: "SO-2026-0145", customerId: "CUS-004", status: "partially_shipped",
    orderDate: "2026-06-01", dueDate: "2026-07-20", total: 187600, currency: "USD",
    createdBy: "Order Manager",
    lines: [
      { id: "L1", productId: "P-1002", qty: 30, unitPrice: 4550, dueDate: "2026-07-20", status: "in_production" },
      { id: "L2", productId: "P-1001", qty: 40, unitPrice: 1620, dueDate: "2026-07-15", status: "shipped" },
    ],
  },
  {
    id: "SO-2026-0146", number: "SO-2026-0146", customerId: "CUS-005", status: "draft",
    orderDate: "2026-07-02", dueDate: "2026-08-30", total: 28800, currency: "USD",
    createdBy: "Order Manager",
    lines: [{ id: "L1", productId: "P-1004", qty: 300, unitPrice: 96, dueDate: "2026-08-30", status: "pending" }],
  },
  {
    id: "SO-2026-0147", number: "SO-2026-0147", customerId: "CUS-006", status: "confirmed",
    orderDate: "2026-07-05", dueDate: "2026-08-12", total: 74100, currency: "USD",
    createdBy: "Order Manager",
    lines: [
      { id: "L1", productId: "P-1001", qty: 45, unitPrice: 1620, dueDate: "2026-08-12", status: "pending" },
    ],
  },
];

export const productionOrders: ProductionOrder[] = [
  { id: "PO-2026-0231", number: "PO-2026-0231", salesOrderId: "SO-2026-0142", productId: "P-1001", qty: 60, status: "in_progress", priority: 2, plannedStart: "2026-07-05", plannedEnd: "2026-07-22", actualStart: "2026-07-06", qtyProduced: 38, qtyScrap: 2 },
  { id: "PO-2026-0232", number: "PO-2026-0232", salesOrderId: "SO-2026-0142", productId: "P-1003", qty: 120, status: "planned", priority: 1, plannedStart: "2026-07-14", plannedEnd: "2026-07-26", qtyProduced: 0, qtyScrap: 0 },
  { id: "PO-2026-0233", number: "PO-2026-0233", salesOrderId: "SO-2026-0143", productId: "P-1002", qty: 20, status: "released", priority: 3, plannedStart: "2026-07-12", plannedEnd: "2026-07-30", qtyProduced: 0, qtyScrap: 0 },
  { id: "PO-2026-0234", number: "PO-2026-0234", salesOrderId: "SO-2026-0145", productId: "P-1002", qty: 30, status: "in_progress", priority: 3, plannedStart: "2026-06-25", plannedEnd: "2026-07-18", actualStart: "2026-06-26", qtyProduced: 14, qtyScrap: 1 },
  { id: "PO-2026-0235", number: "PO-2026-0235", salesOrderId: "SO-2026-0144", productId: "P-1003", qty: 96, status: "completed", priority: 2, plannedStart: "2026-06-05", plannedEnd: "2026-06-30", actualStart: "2026-06-06", actualEnd: "2026-06-28", qtyProduced: 96, qtyScrap: 3 },
  { id: "PO-2026-0236", number: "PO-2026-0236", salesOrderId: "SO-2026-0147", productId: "P-1001", qty: 45, status: "planned", priority: 2, plannedStart: "2026-07-18", plannedEnd: "2026-08-08", qtyProduced: 0, qtyScrap: 0 },
];

export const workOrders: WorkOrder[] = [
  { id: "WO-0891", number: "WO-0891", productionOrderId: "PO-2026-0231", seq: 10, operation: "Casting", workstationId: "WS-01", status: "completed", operatorId: "U-005", qtyTarget: 60, qtyProduced: 60, qtyScrap: 1, laborMin: 620, progress: 100 },
  { id: "WO-0892", number: "WO-0892", productionOrderId: "PO-2026-0231", seq: 20, operation: "Rough Machining", workstationId: "WS-02", status: "in_progress", operatorId: "U-006", qtyTarget: 60, qtyProduced: 38, qtyScrap: 1, laborMin: 410, progress: 63 },
  { id: "WO-0893", number: "WO-0893", productionOrderId: "PO-2026-0231", seq: 30, operation: "Weld Attachments", workstationId: "WS-04", status: "pending", qtyTarget: 60, qtyProduced: 0, qtyScrap: 0, laborMin: 0, progress: 0 },
  { id: "WO-0894", number: "WO-0894", productionOrderId: "PO-2026-0234", seq: 10, operation: "Casting", workstationId: "WS-01", status: "completed", operatorId: "U-005", qtyTarget: 30, qtyProduced: 30, qtyScrap: 1, laborMin: 720, progress: 100 },
  { id: "WO-0895", number: "WO-0895", productionOrderId: "PO-2026-0234", seq: 20, operation: "Precision Machining", workstationId: "WS-03", status: "in_progress", operatorId: "U-007", qtyTarget: 30, qtyProduced: 14, qtyScrap: 0, laborMin: 480, progress: 47 },
  { id: "WO-0896", number: "WO-0896", productionOrderId: "PO-2026-0234", seq: 30, operation: "Motor Assembly", workstationId: "WS-05", status: "pending", qtyTarget: 30, qtyProduced: 0, qtyScrap: 0, laborMin: 0, progress: 0 },
  { id: "WO-0897", number: "WO-0897", productionOrderId: "PO-2026-0235", seq: 60, operation: "Pack & Label", workstationId: "WS-08", status: "completed", operatorId: "U-008", qtyTarget: 96, qtyProduced: 96, qtyScrap: 0, laborMin: 260, progress: 100 },
  { id: "WO-0898", number: "WO-0898", productionOrderId: "PO-2026-0233", seq: 10, operation: "Casting", workstationId: "WS-01", status: "paused", operatorId: "U-005", qtyTarget: 20, qtyProduced: 6, qtyScrap: 0, laborMin: 140, progress: 30 },
];

export const inventory: InventoryLine[] = [
  { productId: "P-1001", workstationId: null, qty: 12, reserved: 8, updated: "2026-07-10" },
  { productId: "P-1002", workstationId: null, qty: 4, reserved: 4, updated: "2026-07-10" },
  { productId: "P-1003", workstationId: null, qty: 84, reserved: 30, updated: "2026-07-11" },
  { productId: "P-1004", workstationId: null, qty: 220, reserved: 40, updated: "2026-07-11" },
  { productId: "P-2001", workstationId: "WS-01", qty: 18500, reserved: 4200, updated: "2026-07-11" },
  { productId: "P-2002", workstationId: "WS-03", qty: 6800, reserved: 1400, updated: "2026-07-11" },
  { productId: "P-2003", workstationId: "WS-05", qty: 4200, reserved: 800, updated: "2026-07-11" },
];

export const inventoryTxns: InventoryTxn[] = [
  { id: "IT-9821", productId: "P-2001", type: "receipt", qty: 5000, ref: "GR-4412", at: "2026-07-10 08:14", user: "Warehouse" },
  { id: "IT-9822", productId: "P-2001", type: "issue", qty: -1200, ref: "WO-0894", at: "2026-07-10 10:30", user: "Foundry" },
  { id: "IT-9823", productId: "P-1001", type: "receipt", qty: 30, ref: "WO-0891", at: "2026-07-10 15:02", user: "Assembly" },
  { id: "IT-9824", productId: "P-2002", type: "receipt", qty: 2000, ref: "GR-4418", at: "2026-07-11 07:45", user: "Warehouse" },
  { id: "IT-9825", productId: "P-1003", type: "issue", qty: -96, ref: "SHP-0774", at: "2026-07-11 12:10", user: "Shipping" },
  { id: "IT-9826", productId: "P-2003", type: "adjust", qty: -12, ref: "Cycle Count", at: "2026-07-11 14:40", user: "Warehouse" },
];

export const shipments: Shipment[] = [
  { id: "SHP-0774", number: "SHP-0774", salesOrderId: "SO-2026-0144", carrier: "DHL Freight", tracking: "1Z999AA10123456784", status: "delivered", shippedAt: "2026-07-01" },
  { id: "SHP-0775", number: "SHP-0775", salesOrderId: "SO-2026-0145", carrier: "Aramex Cargo", tracking: "AWB-7788112", status: "shipped", shippedAt: "2026-07-08" },
  { id: "SHP-0776", number: "SHP-0776", salesOrderId: "SO-2026-0142", carrier: "SNC-Lavalin", tracking: "—", status: "packed" },
  { id: "SHP-0777", number: "SHP-0777", salesOrderId: "SO-2026-0143", carrier: "—", tracking: "—", status: "draft" },
];

export const users: User[] = [
  { id: "U-001", username: "faisal.a", fullName: "Faisal Al-Suwailem", email: "faisal@corta.io", role: "admin", active: true },
  { id: "U-002", username: "leila.h", fullName: "Leila Hariri", email: "leila@corta.io", role: "order_manager", active: true },
  { id: "U-003", username: "omar.b", fullName: "Omar Baroudi", email: "omar@corta.io", role: "production_planner", active: true },
  { id: "U-004", username: "sara.k", fullName: "Sara Khoury", email: "sara@corta.io", role: "supervisor", active: true },
  { id: "U-005", username: "ahmed.f", fullName: "Ahmed Fahmy", email: "ahmed@corta.io", role: "operator", active: true },
  { id: "U-006", username: "yusuf.n", fullName: "Yusuf Nassar", email: "yusuf@corta.io", role: "operator", active: true },
  { id: "U-007", username: "reem.s", fullName: "Reem Saleh", email: "reem@corta.io", role: "operator", active: true },
  { id: "U-008", username: "hassan.m", fullName: "Hassan Al-Mutairi", email: "hassan@corta.io", role: "operator", active: false },
];

export const auditLog: AuditLog[] = [
  { id: "A-4419", at: "2026-07-11 14:52", user: "leila.h", action: "sales_order.create", entity: "SO-2026-0146", detail: "Created draft order for NEOM Industrial" },
  { id: "A-4418", at: "2026-07-11 14:22", user: "omar.b", action: "production_order.release", entity: "PO-2026-0233", detail: "Released PO for Pump CX-45 x20" },
  { id: "A-4417", at: "2026-07-11 13:40", user: "sara.k", action: "work_order.assign", entity: "WO-0895", detail: "Assigned to Reem Saleh @ CNC Cell 2" },
  { id: "A-4416", at: "2026-07-11 12:10", user: "hassan.m", action: "shipment.ship", entity: "SHP-0774", detail: "Marked shipped, tracking 1Z999AA10123456784" },
  { id: "A-4415", at: "2026-07-11 11:05", user: "ahmed.f", action: "work_order.complete", entity: "WO-0891", detail: "60 units, 1 scrap, 620min labor" },
  { id: "A-4414", at: "2026-07-11 10:20", user: "faisal.a", action: "user.update", entity: "U-008", detail: "Deactivated user hassan.m" },
];

// helpers
export const findCustomer = (id: string) => customers.find((c) => c.id === id);
export const findProduct = (id: string) => products.find((p) => p.id === id);
export const findWorkstation = (id: string) => workstations.find((w) => w.id === id);
export const findUser = (id: string) => users.find((u) => u.id === id);
export const findSO = (id: string) => salesOrders.find((s) => s.id === id);
export const findPO = (id: string) => productionOrders.find((p) => p.id === id);
export const findWO = (id: string) => workOrders.find((w) => w.id === id);

// dashboard KPIs
export const dashboardKpis = {
  openOrders: salesOrders.filter(s => !["shipped","cancelled"].includes(s.status)).length,
  inProduction: productionOrders.filter(p => p.status === "in_progress").length,
  overdue: 2,
  shippedThisWeek: 7,
  revenue: salesOrders.reduce((s, o) => s + o.total, 0),
  otdRate: 94.2,
};

export const orderTrend = [
  { d: "Mon", orders: 8, shipped: 5 },
  { d: "Tue", orders: 12, shipped: 7 },
  { d: "Wed", orders: 9, shipped: 8 },
  { d: "Thu", orders: 14, shipped: 10 },
  { d: "Fri", orders: 11, shipped: 9 },
  { d: "Sat", orders: 6, shipped: 4 },
  { d: "Sun", orders: 4, shipped: 3 },
];

export const productionMix = [
  { name: "Casting", value: 32, color: "oklch(0.78 0.16 195)" },
  { name: "Machining", value: 28, color: "oklch(0.78 0.18 75)" },
  { name: "Welding", value: 14, color: "oklch(0.72 0.18 155)" },
  { name: "Assembly", value: 18, color: "oklch(0.72 0.14 230)" },
  { name: "QA/Pack", value: 8, color: "oklch(0.65 0.24 22)" },
];
