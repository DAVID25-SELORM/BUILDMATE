import { describe, expect, it } from "vitest";
import { listingSchema, productSchema } from "./validation";

describe("catalogue validation", () => {
  it("accepts a valid product", () => {
    expect(productSchema.safeParse({ name: "Cement", slug: "cement", categoryId: crypto.randomUUID(), brandId: "", description: "", baseUnit: "bag", isActive: true }).success).toBe(true);
  });
  it("rejects unsafe product slugs", () => {
    expect(productSchema.safeParse({ name: "Cement", slug: "Cement / bag", categoryId: crypto.randomUUID(), brandId: "", description: "", baseUnit: "bag", isActive: true }).success).toBe(false);
  });
  it("rejects negative listing prices", () => {
    expect(listingSchema.safeParse({ productId: crypto.randomUUID(), sku: "", price: -1, wholesalePrice: "", wholesaleMinimum: "", stockQuantity: "", stockStatus: "in_stock", leadTimeDays: 1, isActive: true }).success).toBe(false);
  });
});
