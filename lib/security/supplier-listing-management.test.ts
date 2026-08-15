import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const assignments = readFileSync(join(process.cwd(), "supabase", "migrations", "202608070043_assignment_level_isolation.sql"), "utf8").toLowerCase();
const lifecycle = readFileSync(join(process.cwd(), "supabase", "migrations", "202608120050_master_catalogue_listing_lifecycle.sql"), "utf8").toLowerCase();
const publishValidation = readFileSync(join(process.cwd(), "supabase", "migrations", "202608150054_supplier_listing_publish_validation.sql"), "utf8").toLowerCase();
const variantsAndPrices = readFileSync(join(process.cwd(), "supabase", "migrations", "202608150055_supplier_variants_and_field_prices.sql"), "utf8").toLowerCase();

describe("supplier listing management security", () => {
  it("isolates listing reads and updates by organisation permission and assignments", () => {
    expect(assignments).toContain("has_permission('products.view',supplier_id)");
    expect(assignments).toContain("has_permission('products.edit',supplier_id)");
    expect(assignments).toContain("member_has_branch_access(supplier_id,branch_id)");
    expect(assignments).toContain("member_has_warehouse_access(supplier_id,warehouse_id)");
  });

  it("keeps drafts out of the public marketplace", () => {
    expect(lifecycle).toContain("listing_status = 'published'");
    expect(lifecycle).toContain("and is_active");
    expect(lifecycle).toContain("verification_status = 'approved'");
  });

  it("enforces publishing readiness in the database", () => {
    expect(publishValidation).toContain("new.price is null");
    expect(publishValidation).toContain("new.stock_status = 'out_of_stock'");
    expect(publishValidation).toContain("o.account_status = 'active'");
    expect(publishValidation).toContain("o.verification_status = 'approved'");
    expect(publishValidation).toContain("o.product_publishing_enabled");
    expect(publishValidation).toContain("new.branch_id is null");
  });

  it("keeps variant prices structured, drafts private, and price history append-only", () => {
    expect(variantsAndPrices).toContain("create table if not exists public.product_variants");
    expect(variantsAndPrices).toContain("create table if not exists public.supplier_price_history");
    expect(variantsAndPrices).toContain("after insert or update of price");
    expect(variantsAndPrices).toContain("'confirmation_required',false,'draft'");
    expect(variantsAndPrices).toContain("'2026-08-08'");
    expect(variantsAndPrices).toContain("supplier_price_clarifications");
  });
});
