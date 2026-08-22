import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { DRIVER_NAV } from "@/lib/driver/navigation";
import { customerCoreNavigation } from "@/lib/organisations/navigation";

const providerLayout = readFileSync("app/provider/layout.tsx", "utf8");
const supplierNav = readFileSync(
  "components/supplier/supplier-nav.ts",
  "utf8",
);
const dashboardShell = readFileSync(
  "components/dashboard/DashboardShell.tsx",
  "utf8",
);

describe("dashboard navigation completeness", () => {
  it("exposes every driver workspace section from one navigation source", () => {
    expect(DRIVER_NAV.map((item) => item.label)).toEqual([
      "Overview",
      "Available jobs",
      "Assigned deliveries",
      "Current delivery",
      "Completed deliveries",
      "Availability",
      "Vehicle",
      "Profile / Settings",
      "Support",
    ]);
    expect(new Set(DRIVER_NAV.map((item) => item.href)).size).toBe(
      DRIVER_NAV.length,
    );
  });

  it("supports query-owned tabs without marking every tab active", () => {
    expect(dashboardShell).toContain("isCurrentHref(item.href)");
    expect(dashboardShell).toContain('!item.href.includes("?")');
    expect(dashboardShell).toContain('aria-current={active ? "page" : undefined}');
  });

  it("keeps all implemented provider sections visible", () => {
    for (const href of [
      "/provider",
      "/provider/requests",
      "/provider/availability",
      "/provider/profile",
      "/provider/reviews",
      "/support",
    ]) {
      expect(providerLayout).toContain(`href: "${href}"`);
    }
  });

  it("keeps support visible in every shared portal navigation", () => {
    expect(supplierNav).toContain('{ label: "Support", href: "/support"');
    expect(customerCoreNavigation.some((item) => item.href === "/support")).toBe(
      true,
    );
    expect(ADMIN_NAV.some((item) => item.href === "/admin/support")).toBe(true);
  });
});
