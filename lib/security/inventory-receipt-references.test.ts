import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/202608220070_inventory_receipt_references_and_opening_stock.sql",
  "utf8",
);
const forms = readFileSync(
  "components/supplier/inventory/InventoryOperationForms.tsx",
  "utf8",
);
const actions = readFileSync("app/supplier/inventory/actions.ts", "utf8");

describe("stock receipt references and opening stock", () => {
  it("generates unique internal references and preserves legacy receipts", () => {
    expect(migration).toContain("inventory_grn_number_seq");
    expect(migration).toContain("inventory_opening_number_seq");
    expect(migration).toContain("GRN-LEGACY-");
    expect(migration).toContain("inventory_receipts_internal_reference_unique");
    expect(migration).toContain("GRN-");
    expect(migration).toContain("OPEN-");
  });

  it("posts each request once and keeps posted receipts immutable", () => {
    expect(migration).toContain("inventory_receipts_request_key_unique");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("if r.id is not null then");
    expect(migration).toContain("for update");
    expect(migration).toContain("prevent_posted_inventory_receipt_change");
    expect(actions).toContain("target_request_key: requestKey");
  });

  it("uses distinct canonical movements for receipts and opening stock", () => {
    expect(migration).toContain("'purchase_receipt'");
    expect(migration).toContain("'opening_stock'");
    expect(migration).toContain(
      "Opening stock can only be set before inventory movement history exists",
    );
    expect(migration).toContain("INVENTORY_RECEIPT_POSTED");
    expect(migration).toContain("INVENTORY_OPENING_STOCK_POSTED");
    expect(actions).toContain("inventory_set_opening_stock");
  });

  it("makes vendor paperwork optional and explains the two flows", () => {
    expect(migration).toContain("nullif(trim(coalesce(target_vendor,'')),'')");
    expect(migration).toContain("nullif(trim(coalesce(target_invoice,'')),'')");
    expect(forms).toContain("Vendor invoice / delivery note");
    expect(forms).toContain("Optional reference from your vendor.");
    expect(forms).toContain(
      "Opening stock establishes the first immutable inventory balance.",
    );
    expect(forms).not.toContain(
      '<input className="input" name="invoice" required',
    );
  });

  it("returns receipt metadata for movement history and success review", () => {
    for (const field of [
      "internal_reference",
      "vendor",
      "external_reference",
      "receipt_date",
    ])
      expect(migration).toContain(`'${field}'`);
    expect(forms).toContain("View movement");
    expect(forms).toContain("Receive more stock");
    expect(migration).toContain("inventory_search_movement_references");
    expect(migration).toContain("or is_platform_admin()");
  });
});
