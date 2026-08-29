import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { supplierNav } from "./supplier-nav";

describe("supplierNav", () => {
  it("keeps every supplier route in one stable order", () => {
    expect(supplierNav.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Overview", href: "/supplier" },
      { label: "Orders", href: "/supplier/orders" },
      { label: "Quotation requests", href: "/supplier/quotations" },
      { label: "Products", href: "/supplier/products" },
      { label: "Inventory", href: "/supplier/inventory" },
      { label: "Inventory reports", href: "/supplier/inventory/reports" },
      { label: "Settlements", href: "/supplier/settlements" },
      { label: "Staff", href: "/supplier/staff" },
      { label: "Organisation settings", href: "/supplier/settings" },
      { label: "Support", href: "/support" },
    ]);
  });

  it("does not contain duplicate destinations", () => {
    const destinations = supplierNav.map((item) => item.href);
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it("keeps every supplier destination backed by an operational route", () => {
    const routeFiles: Record<string, string> = {
      "/supplier": "app/supplier/page.tsx",
      "/supplier/orders": "app/supplier/orders/page.tsx",
      "/supplier/quotations": "app/supplier/quotes/page.tsx",
      "/supplier/products": "app/supplier/products/page.tsx",
      "/supplier/inventory": "app/supplier/inventory/page.tsx",
      "/supplier/inventory/reports": "app/supplier/inventory/reports/page.tsx",
      "/supplier/settlements": "app/supplier/settlements/page.tsx",
      "/supplier/staff": "app/supplier/staff/page.tsx",
      "/supplier/settings": "app/supplier/settings/page.tsx",
      "/support": "app/support/page.tsx",
    };

    for (const { href } of supplierNav) {
      const routeFile = join(process.cwd(), routeFiles[href]);
      expect(existsSync(routeFile), `${href} must have a page`).toBe(true);
      const source = readFileSync(routeFile, "utf8");
      expect(
        source.includes("requireSupplierPermission") || source.includes("auth.getUser"),
        `${href} must enforce authenticated access`,
      ).toBe(true);
    }
  });
});
