import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "202608210066_marketplace_inventory_eligibility.sql"), "utf8").toLowerCase();
const detail = readFileSync(join(process.cwd(), "app", "supplier", "orders", "[id]", "page.tsx"), "utf8");
const overview = readFileSync(join(process.cwd(), "components", "dashboard", "SupplierOverview.tsx"), "utf8");
const orders = readFileSync(join(process.cwd(), "components", "dashboard", "PortalSectionViews.tsx"), "utf8");

describe("marketplace inventory eligibility", () => {
  it("requires configured positive exact inventory", () => {
    expect(migration).toContain("inventory_mode='exact_quantity'");
    expect(migration).toContain("stock_quantity is not null and l.stock_quantity>0");
    expect(migration).toContain("branch_id is not null");
  });
  it("excludes confirmation-required offers and permits explicit in-stock status-only offers", () => {
    expect(migration).toContain("inventory_mode='status_only' and l.stock_status='in_stock'");
    expect(migration).not.toContain("inventory_mode='confirmation_required' and");
  });
  it("revalidates eligibility and quantity during checkout", () => {
    expect(migration).toContain("marketplace_listing_is_eligible(l)");
    expect(migration).toContain("this item is no longer available from this supplier");
  });
});

describe("supplier order detail route contract", () => {
  it("uses UUID-backed order IDs from every View link", () => {
    expect(overview).toContain("/supplier/orders/${order.id}");
    expect(orders).toContain("/supplier/orders/${order.id}");
    expect(detail).toContain("orderId: id");
  });
  it("uses the central supplier-isolated loader", () => {
    expect(detail).toContain("getSupplierOrderDetail");
    expect(detail).toContain("organisationId: membership.organisationId");
  });
});
