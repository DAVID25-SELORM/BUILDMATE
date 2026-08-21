import { describe, expect, it } from "vitest";
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
    ]);
  });

  it("does not contain duplicate destinations", () => {
    const destinations = supplierNav.map((item) => item.href);
    expect(new Set(destinations).size).toBe(destinations.length);
  });
});
