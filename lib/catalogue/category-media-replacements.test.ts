import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/202608220073_category_image_replacements.sql"),
  "utf8",
);
const cementMigration = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/202608220074_cement_concrete_category_image_replacement.sql",
  ),
  "utf8",
);

const expected = [
  "tiles-and-flooring-v3.webp",
  "electrical-v3.webp",
  "plumbing-and-sanitary-v3.webp",
  "roofing-v3.webp",
];

describe("approved category image replacements", () => {
  it("uses four distinct versioned assets", () => {
    for (const filename of expected) {
      expect(migration).toContain(`/images/categories/${filename}`);
      expect(existsSync(path.join(process.cwd(), "public/images/categories", filename))).toBe(true);
    }
    expect(new Set(expected).size).toBe(4);
  });

  it("keeps the complete category set unique", () => {
    expect(migration).toContain("assigned_count<>15 or unique_count<>15");
  });

  it("replaces Cement & Concrete with its approved versioned asset", () => {
    const filename = "cement-and-concrete-v3.webp";
    expect(cementMigration).toContain(`/images/categories/${filename}`);
    expect(
      existsSync(path.join(process.cwd(), "public/images/categories", filename)),
    ).toBe(true);
    expect(cementMigration).toContain("assigned_count<>15 or unique_count<>15");
  });
});
