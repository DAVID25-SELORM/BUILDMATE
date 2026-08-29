import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public header authentication state", () => {
  const header = readFileSync(join(process.cwd(), "components/layout/Header.tsx"), "utf8");
  const mobileMenu = readFileSync(join(process.cwd(), "components/layout/MobileMenu.tsx"), "utf8");

  it("uses the authenticated user and canonical role redirect", () => {
    expect(header).toContain("auth.getUser()");
    expect(header).toContain("getRedirectForRole(profile?.role)");
    expect(header).toContain('role === "supplier"');
    expect(header).toContain('return "Supplier Portal"');
    expect(header).toContain('return "Driver Portal"');
    expect(header).toContain('return "Admin Portal"');
    expect(header).toContain('return "Customer Portal"');
  });

  it("does not render anonymous calls to action for a signed-in user", () => {
    expect(header).toContain("{user ? (");
    expect(header).toContain("<SignOutButton");
    expect(mobileMenu).toContain("{signedIn ? (");
    expect(mobileMenu).toContain("accountHref");
  });
});
