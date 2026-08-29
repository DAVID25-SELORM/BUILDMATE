import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/202608280076_simplified_supplier_selling_workflow.sql",
  "utf8",
);
const form = readFileSync(
  "components/supplier/products/SimplifiedAddProductForm.tsx",
  "utf8",
);
const actions = readFileSync("app/supplier/products/actions.ts", "utf8");
const preview = readFileSync(
  "components/dashboard/PortalSectionViews.tsx",
  "utf8",
);
const inventory = readFileSync("app/supplier/inventory/page.tsx", "utf8");
const productList = readFileSync(
  "components/supplier/products/SupplierInventoryEditor.tsx",
  "utf8",
);
const mediaManager = readFileSync(
  "components/commerce/ProductMediaManager.tsx",
  "utf8",
);
const duplicateAudit = readFileSync(
  "supabase/tests/nana_product_identity_audit.sql",
  "utf8",
);

describe("simplified supplier selling workflow", () => {
  it("creates listing, opening stock and publication in one transaction", () => {
    expect(sql).toContain("supplier_create_product_for_sale");
    expect(sql).toContain("inventory_set_opening_stock");
    expect(sql).toContain("listing_status='published',is_active=true");
  });
  it("retains permission, branch and duplicate protections", () => {
    expect(sql).toContain("has_permission('products.create'");
    expect(sql).toContain("member_has_branch_access");
    expect(sql).toContain("You already sell this product at");
    expect(actions).toContain("This product is already in your product list.");
    expect(form).toContain("Available to add");
    expect(form).toContain("Manage product");
    expect(form).toContain("Add stock");
  });
  it("routes missing products through an audited catalogue request", () => {
    expect(sql).toContain("supplier_catalogue_requests");
    expect(sql).toContain("admin_has_permission('catalogue')");
    expect(sql).toContain("CATALOGUE_PRODUCT_REQUESTED");
    expect(actions).toContain('.from("product-media")');
    expect(actions).toContain("5 * 1024 * 1024");
    expect(actions).toContain("image/jpeg");
  });
  it("renders the same guided form read-only in supplier preview", () => {
    expect(preview).toContain("<SimplifiedAddProductForm");
    expect(preview).toContain("readOnly");
    expect(form).toContain(
      "Preview only. Product and stock changes are disabled.",
    );
    expect(form).toContain("event.preventDefault()");
    expect(form).toContain("pending || readOnly");
  });
  it("lets a ready stocked draft publish from the inventory workflow", () => {
    expect(inventory).toContain("listingCompletion(");
    expect(inventory).toContain(">\n                          Publish\n");
    expect(inventory).toContain("setListingActive.bind(");
  });
  it("renders canonical variant identity in products and listing galleries", () => {
    expect(productList).toContain("<th>Variant</th>");
    expect(productList).toContain("<th>SKU</th>");
    expect(productList).toContain('variant?.name ?? "Standard"');
    expect(mediaManager).toContain("listing.variantName");
    expect(mediaManager).toContain("listing.branchName");
  });
  it("keeps the Nana duplicate audit read-only and reference-safe", () => {
    expect(duplicateAudit).toContain("having count(*)>1");
    expect(duplicateAudit).toContain("public.inventory_balances");
    expect(duplicateAudit).toContain("entry_type='opening_stock'");
    expect(duplicateAudit).not.toMatch(/\b(delete|update|insert)\b/i);
  });
});
