import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const forms = readFileSync(
  join(
    process.cwd(),
    "components",
    "supplier",
    "inventory",
    "InventoryOperationForms.tsx",
  ),
  "utf8",
);
const review = readFileSync(
  join(
    process.cwd(),
    "components",
    "supplier",
    "inventory",
    "ConfirmInventoryAction.tsx",
  ),
  "utf8",
);
const page = readFileSync(
  join(process.cwd(), "app", "supplier", "inventory", "page.tsx"),
  "utf8",
);

describe("receive stock interaction", () => {
  it("opens row receipts locally with preloaded listing context", () => {
    expect(page).toContain("OpenInventoryOperationButton");
    expect(page).not.toContain("href={`/supplier/inventory?receive=");
    expect(forms).toContain("inventoryOperationEvent");
    expect(forms).toContain("locked={rowLocked}");
    expect(forms).toContain("selectedReceive.marketplace");
  });

  it("shows stock and permission-aware cost context", () => {
    for (const label of [
      "Selling price",
      "On hand",
      "Reserved",
      "Available",
      "Average cost",
      "Needs stock setup",
      "Restricted",
    ]) {
      expect(forms).toContain(label);
    }
  });

  it("reviews weighted cost and potential—not realised—value", () => {
    expect(review).toContain("Projected weighted average cost");
    expect(review).toContain("Projected stock cost value");
    expect(review).toContain("Potential sales value");
    expect(review).toContain("Potential gross margin");
    expect(review).not.toContain("realised profit");
    expect(review).toContain("Confirm & Receive Stock");
  });

  it("uses one reliable inline review step for every inventory operation", () => {
    expect(review).toContain("setReviewing(true)");
    expect(review).toContain('aria-live="polite"');
    expect(review).toContain("Back to edit");
    expect(review).toContain("formRef.current?.requestSubmit()");
    expect(review).not.toContain("showModal()");
    expect(review).not.toContain("<dialog");
    for (const kind of [
      'kind="receipt"',
      'kind="adjustment"',
      'kind="transfer"',
    ]) {
      expect(forms).toContain(kind);
    }
  });

  it("finds the actual select when a locked receipt has duplicate field names", () => {
    expect(review).toContain('form.querySelectorAll<HTMLSelectElement>("select")');
    expect(review).toContain("element?.options.item(element.selectedIndex)");
    expect(review).not.toContain("form.elements.namedItem(name)");
    expect(review).not.toContain("selectedOptions");
  });
});
