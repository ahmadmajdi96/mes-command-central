import type { Role } from "./store";

export interface Permissions {
  manageUsers: boolean;
  editSettings: boolean;
  createOrder: boolean;
  editOrder: boolean;
  releasePO: boolean;
  operateWO: boolean;
  viewCosts: boolean;
  viewAudit: boolean;
  createShipment: boolean;
  adjustInventory: boolean;
}

export const permissionsFor = (role: Role): Permissions => {
  switch (role) {
    case "admin":
      return {
        manageUsers: true, editSettings: true, createOrder: true, editOrder: true,
        releasePO: true, operateWO: true, viewCosts: true, viewAudit: true,
        createShipment: true, adjustInventory: true,
      };
    case "order_manager":
      return {
        manageUsers: false, editSettings: false, createOrder: true, editOrder: true,
        releasePO: false, operateWO: false, viewCosts: true, viewAudit: true,
        createShipment: true, adjustInventory: false,
      };
    case "production_planner":
      return {
        manageUsers: false, editSettings: false, createOrder: false, editOrder: false,
        releasePO: true, operateWO: false, viewCosts: true, viewAudit: true,
        createShipment: false, adjustInventory: true,
      };
    case "supervisor":
      return {
        manageUsers: false, editSettings: false, createOrder: false, editOrder: false,
        releasePO: true, operateWO: true, viewCosts: true, viewAudit: true,
        createShipment: false, adjustInventory: true,
      };
    case "operator":
      return {
        manageUsers: false, editSettings: false, createOrder: false, editOrder: false,
        releasePO: false, operateWO: true, viewCosts: false, viewAudit: false,
        createShipment: false, adjustInventory: false,
      };
  }
};

export const roleLabels: Record<Role, string> = {
  admin: "Admin",
  order_manager: "Order Manager",
  production_planner: "Production Planner",
  supervisor: "Supervisor",
  operator: "Operator",
};
