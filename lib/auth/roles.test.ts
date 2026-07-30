import { describe, expect, it } from "vitest";
import { getRedirectForRole, isRegisterableRole } from "./roles";

describe("getRedirectForRole", () => {
  it("sends customers to the shared dashboard", () => {
    expect(getRedirectForRole("customer")).toBe("/dashboard");
  });

  it("sends suppliers to the supplier portal", () => {
    expect(getRedirectForRole("supplier")).toBe("/supplier");
  });

  it("sends admins and super admins to the admin console", () => {
    expect(getRedirectForRole("admin")).toBe("/admin");
    expect(getRedirectForRole("super_admin")).toBe("/admin");
  });

  it("falls back to the shared dashboard for roles without a dedicated workspace", () => {
    expect(getRedirectForRole("contractor")).toBe("/dashboard");
    expect(getRedirectForRole("driver")).toBe("/dashboard");
    expect(getRedirectForRole("professional")).toBe("/dashboard");
  });

  it("falls back to the shared dashboard for unknown or missing roles", () => {
    expect(getRedirectForRole(null)).toBe("/dashboard");
    expect(getRedirectForRole(undefined)).toBe("/dashboard");
    expect(getRedirectForRole("not-a-role")).toBe("/dashboard");
  });
});

describe("isRegisterableRole", () => {
  it("accepts self-registerable roles", () => {
    expect(isRegisterableRole("customer")).toBe(true);
    expect(isRegisterableRole("supplier")).toBe(true);
  });

  it("rejects admin roles", () => {
    expect(isRegisterableRole("admin")).toBe(false);
    expect(isRegisterableRole("super_admin")).toBe(false);
  });
});
