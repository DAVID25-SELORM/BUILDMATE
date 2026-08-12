import { describe, expect, it } from "vitest";
import { invitePlatformStaffSchema } from "./validation";

const valid = {
  fullName: "Mary Sarpong",
  email: "mary@example.com",
  phone: "0598006449",
  roleKey: "supplier_verification_admin",
  department: "Supplier Verification",
  extraPermissions: [],
  reason: "New permanent staff appointment",
};

describe("platform staff invitation validation", () => {
  it("accepts controlled department and access reason values", () => {
    expect(invitePlatformStaffSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects arbitrary department and access reason values", () => {
    expect(invitePlatformStaffSchema.safeParse({ ...valid, department: "admin" }).success).toBe(false);
    expect(invitePlatformStaffSchema.safeParse({ ...valid, reason: "platform staff" }).success).toBe(false);
  });
});
