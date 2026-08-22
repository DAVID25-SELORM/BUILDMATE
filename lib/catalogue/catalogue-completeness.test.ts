import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202608220071_catalogue_completeness_and_nana_expansion.sql",
  ),
  "utf8",
).toLowerCase();
const shop = readFileSync(
  join(process.cwd(), "app", "(public)", "shop", "page.tsx"),
  "utf8",
);
const supplierProducts = readFileSync(
  join(process.cwd(), "components", "supplier", "products", "SupplierInventoryEditor.tsx"),
  "utf8",
);
const home = readFileSync(
  join(process.cwd(), "app", "(public)", "page.tsx"),
  "utf8",
);

describe("catalogue completeness migration", () => {
  it("creates the approved customer groups and BOQ-ready canonical products", () => {
    for (const value of [
      "cement-concrete",
      "blocks-masonry",
      "doors-windows",
      "plumbing-sanitary",
      "electrical",
      "tiles-flooring",
      "ceilings-drywall",
      "kitchen-joinery",
      "external-works",
      "portland-cement",
      "concrete-blocks",
      "pvc-pipes",
      "electrical-cables",
      "gypsum-boards",
    ])
      expect(migration).toContain(value);
    expect(migration).toContain("('high-tensile-reinforcement-bars','12 mm','12mm'");
  });

  it("adds precise aliases without broad inferred supplier claims", () => {
    for (const alias of ["iron rods", "reinforcement steel", "aluminium roofing", "plastic pipes"])
      expect(migration).toContain(alias);
    expect(migration).toContain("from unnest(p.search_aliases) alias");
    expect(migration).toContain("like '%'||lower(alias)||'%'");
    expect(migration).not.toContain("3-bedroom quantity");
  });

  it("keeps Nana expansion branch-bound, draft, stockless and warehouse-free", () => {
    expect(migration).toContain("9b232d45-65f6-4f7d-83d5-d0907f98b4ff");
    expect(migration).toContain("eca78e0f-1054-4c22-9d89-c36eba8d687c");
    expect(migration).toContain("'confirmation_required','confirmation_required',false,'draft'");
    expect(migration).toContain("'stock',null");
    expect(migration).toContain("'publication','none'");
    expect(migration).not.toContain("listing_status,'published'");
    for (const uncertain of ["cybers board", "black rubber for building", "headrail / handle / trowel"])
      expect(migration).not.toContain(uncertain);
  });

  it("records the required catalogue and listing audit events", () => {
    for (const event of [
      "catalogue_completeness_update",
      "nana_catalogue_expansion",
      "variant_created",
      "supplier_listing_created",
    ])
      expect(migration).toContain(event);
  });
});

describe("catalogue user experience", () => {
  it("filters top-level categories through their subcategory ids", () => {
    expect(shop).toContain("selectedCategoryIds");
    expect(shop).toContain('query = query.in(');
    expect(shop).toContain('"products.category_id"');
    expect(shop).toContain("item.parent_id == null");
  });

  it("loads live top-level categories on both public catalogue surfaces", () => {
    expect(home).toContain('.is("parent_id", null)');
    expect(home).toContain('href="/shop#categories"');
    expect(shop).toContain('id="categories"');
    expect(shop).toContain("topLevelCategories.map");
    expect(home).toContain("image_path,image_alt,description");
    expect(shop).toContain("image_path,image_alt,description");
    expect(shop).toContain("imagePath={item.image_path}");
  });

  it("shows category and marketplace visibility to suppliers", () => {
    expect(supplierProducts).toContain("Category");
    expect(supplierProducts).toContain("Marketplace visibility");
    expect(supplierProducts).toContain("marketplaceVisibility");
  });
});
