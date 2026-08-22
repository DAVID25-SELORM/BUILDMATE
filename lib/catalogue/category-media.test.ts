import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/202608220072_category_image_metadata.sql"),
  "utf8",
);

const imagePaths = [...migration.matchAll(/'\/(images\/categories\/[^']+\.(?:webp|png|jpg|jpeg|avif))'/g)]
  .map((match) => match[1]);

describe("top-level category media", () => {
  it("assigns one distinct image path to each of the 15 categories", () => {
    expect(imagePaths).toHaveLength(15);
    expect(new Set(imagePaths).size).toBe(15);
  });

  it("references existing, visually distinct image files", () => {
    const hashes = imagePaths.map((imagePath) => {
      const absolutePath = path.join(process.cwd(), "public", imagePath);
      expect(existsSync(absolutePath), imagePath).toBe(true);
      return createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
    });
    expect(new Set(hashes).size).toBe(15);
  });

  it("enforces complete unique metadata in the database", () => {
    expect(migration).toContain("categories_top_level_image_path_unique");
    expect(migration).toContain("unique_image_count<>15");
    expect(migration).toContain("image_count<>15");
  });
});
