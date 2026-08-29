import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("customer product media resolution", () => {
  const card = readFileSync(
    join(process.cwd(), "components/commerce/ProductCard.tsx"),
    "utf8",
  );
  const featured = readFileSync(
    join(process.cwd(), "lib/catalogue/featured-products.ts"),
    "utf8",
  );
  const detail = readFileSync(
    join(process.cwd(), "app/(public)/shop/[productId]/page.tsx"),
    "utf8",
  );
  const migration = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/202608290078_visible_product_media_reconciliation.sql",
    ),
    "utf8",
  );

  it("never substitutes category hero media for a missing product image", () => {
    expect(card).toContain("Product image coming soon");
    expect(card).not.toContain("/images/categories/");
    expect(card).not.toContain("cement-and-concrete.webp");
  });

  it("uses listing media before master media and keeps offer images isolated", () => {
    expect(featured).toContain(
      "product_media(storage_path,alt_text,is_cover,sort_order)",
    );
    expect(featured).toContain(": product.products.images?.[0]");
    expect(detail).toContain("offer.product_media");
    expect(detail).toContain("imageUrl: offerImageUrl");
  });

  it("assigns versioned product-specific media to both mismatched live products", () => {
    expect(migration).toContain("/images/products/cabinet-adhesive-v1.webp");
    expect(migration).toContain("/images/products/louvre-glass-v1.webp");
  });
});
