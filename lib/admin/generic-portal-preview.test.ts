import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const preview = readFileSync(
  "components/admin/GenericPortalPreview.tsx",
  "utf8",
);
const supplierShell = readFileSync(
  "components/supplier/SupplierPortalShell.tsx",
  "utf8",
);
const supplierSidebar = readFileSync(
  "components/supplier/SupplierSidebar.tsx",
  "utf8",
);
const customerNavigation = readFileSync(
  "lib/organisations/navigation.ts",
  "utf8",
);
const supplierNavigation = readFileSync(
  "components/supplier/supplier-nav.ts",
  "utf8",
);
const proxy = readFileSync("proxy.ts", "utf8");
const supportPreview = readFileSync(
  "app/admin/preview/customer/[id]/[[...section]]/page.tsx",
  "utf8",
);

describe("generic portal previews", () => {
  it("uses shared real portal shells and navigation", () => {
    expect(preview).toContain("DashboardShell");
    expect(preview).toContain("SupplierPortalShell");
    expect(preview).toContain("customerCoreNavigation");
    expect(supplierShell).toContain("SupplierSidebar");
    expect(supplierSidebar).toContain("supplierNav.map");
  });

  it("contains the complete customer and supplier navigation", () => {
    for (const label of [
      "Home",
      "Shop",
      "Categories",
      "Projects",
      "Orders",
      "Quotations",
      "Services",
      "Account",
      "Support",
    ])
      expect(customerNavigation).toContain(label);
    for (const label of [
      "Overview",
      "Orders",
      "Quotation requests",
      "Products",
      "Inventory",
      "Inventory reports",
      "Settlements",
      "Staff",
      "Organisation settings",
    ])
      expect(supplierNavigation).toContain(label);
    for (const route of [
      "orders",
      "quotations",
      "products",
      "inventory",
      "inventory/reports",
      "settlements",
      "staff",
      "settings",
    ])
      expect(existsSync(`app/admin/preview/supplier/${route}/page.tsx`)).toBe(
        true,
      );
  });

  it("provides customer, driver, and provider deep routes", () => {
    for (const route of ["orders", "projects", "services"])
      expect(existsSync(`app/admin/preview/customer/${route}/page.tsx`)).toBe(
        true,
      );
    expect(
      existsSync("app/admin/preview/driver/assigned-deliveries/page.tsx"),
    ).toBe(true);
    expect(
      existsSync("app/admin/preview/provider/service-requests/page.tsx"),
    ).toBe(true);
  });

  it("never queries real portal data", () => {
    expect(preview).not.toContain(".from(");
    expect(preview).not.toContain(".rpc(");
    expect(preview).not.toContain("createClient");
  });

  it("blocks generic preview writes at the request boundary", () => {
    expect(proxy).toContain("genericPreview && writeRequest");
    expect(proxy).toContain("Generic portal previews are read only.");
  });

  it("keeps audited account support view separate", () => {
    expect(supportPreview).toContain('requirePortalPreview("customer", id');
    expect(preview).toContain("Open Support View");
    expect(preview).not.toContain("requirePortalPreview");
  });
});
