import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const inventoryPage = readFileSync(
  "app/supplier/inventory/page.tsx",
  "utf8",
);
const inventoryForms = readFileSync(
  "components/supplier/inventory/InventoryOperationForms.tsx",
  "utf8",
);
const inventoryToolbar = readFileSync(
  "components/supplier/inventory/InventoryActionToolbar.tsx",
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
const supplierNav = readFileSync(
  "components/supplier/supplier-nav.ts",
  "utf8",
);

describe("supplier portal control ownership", () => {
  it("owns the canonical inventory actions in one toolbar", () => {
    expect(inventoryPage).not.toContain("+ Add Product");
    expect(inventoryForms.match(/<InventoryActionToolbar/g)).toHaveLength(1);

    for (const label of [
      "+ Add Product",
      "Receive Stock",
      "Adjust Stock",
      "Transfer Stock",
      "Stock Count",
      "Inventory Settings",
      "Export",
    ]) {
      expect(inventoryToolbar).toContain(`"${label}"`);
    }
  });

  it("keeps setup contextual and limited to unconfigured inventory", () => {
    expect(inventoryForms).toContain(
      'item.inventoryMode === "confirmation_required"',
    );
    expect(inventoryForms).toContain("Set Up Stock");
    expect(inventoryToolbar).not.toContain("Set Up Stock");
    expect(inventoryPage).toContain(
      'operation={row.on_hand == null ? "setup" : "receive"}',
    );
    expect(inventoryPage).not.toContain('"Add Stock"');
  });

  it("uses one responsive toolbar without cloning mobile action controls", () => {
    expect(inventoryToolbar).toContain('aria-label="Inventory actions"');
    expect(inventoryToolbar).toContain("More");
    expect(inventoryToolbar).toContain("md:contents");
    expect(inventoryToolbar.match(/Receive Stock/g)).toHaveLength(2);
    expect(inventoryToolbar.match(/Adjust Stock/g)).toHaveLength(2);
  });

  it("keeps shared supplier navigation in the sidebar source of truth", () => {
    expect(supplierShell).toContain("<SupplierSidebar");
    expect(supplierShell).not.toContain('<nav aria-label="Supplier navigation"');
    expect(supplierSidebar.match(/<nav aria-label="Supplier navigation"/g)).toHaveLength(1);

    const hrefs = [...supplierNav.matchAll(/href: "([^"]+)"/g)].map(
      ([, href]) => href,
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
