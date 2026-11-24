import { describe, expect, test } from "bun:test";
import { describeWriteError, getOperationAccess } from "../src/lib/permissions";

const readOnly = { read: true, create: false, update: false, delete: false };

describe("order and shipment operation access", () => {
  test("denies writes when permissions are unknown or the operator can only read", () => {
    for (const grants of [undefined, readOnly]) {
      expect(getOperationAccess(grants)).toEqual({ create: false, update: false, delete: false });
    }
  });

  test("honors the released RLS insert, update and returning rules", () => {
    expect(getOperationAccess({ ...readOnly, create: true, read: false }).create).toBe(false);
    expect(getOperationAccess({ ...readOnly, create: true }))
      .toEqual({ create: true, update: false, delete: false });
    expect(getOperationAccess({ ...readOnly, update: true }))
      .toEqual({ create: true, update: true, delete: false });
    expect(getOperationAccess({ ...readOnly, update: true, delete: true }))
      .toEqual({ create: true, update: true, delete: true });
  });

  test("explains PostgREST permission errors without revealing table policies", () => {
    const message = describeWriteError({ code: "42501", message: "new row violates row-level security policy" }, "create orders");
    expect(message).toBe("You don’t have permission to create orders. Contact your OMS administrator.");
    expect(describeWriteError({}, "create shipments")).toBe("Could not create shipments. Try again.");
  });
});
