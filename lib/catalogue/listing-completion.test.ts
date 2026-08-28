import { describe, expect, it } from "vitest";
import { listingCompletion, listingSummary, marketplaceVisibility, supplierMarketplaceStatus } from "./listing-completion";
import { listingSchema } from "./validation";

describe("supplier inventory completion", () => {
  it("requires eligible configured stock before a listing is ready", () => {
    expect(listingCompletion({ price: 125, stockStatus: "confirmation_required", inventoryMode: "confirmation_required", deliveryAvailable: true, pickupAvailable: false, branchId: "eca78e0f-1054-4c22-9d89-c36eba8d687c", listingStatus: "draft" })).toEqual({
      needsPrice: false,
      needsStockConfirmation: true,
      needsAvailability: true,
      needsBranch: false,
      readyToPublish: false,
      published: false,
    });
  });

  it("blocks readiness for missing price, unavailable stock, fulfilment, or supplier approval", () => {
    expect(listingCompletion({ price: null, stockStatus: "in_stock", deliveryAvailable: true, pickupAvailable: true, branchId: "eca78e0f-1054-4c22-9d89-c36eba8d687c", listingStatus: "draft" }).readyToPublish).toBe(false);
    expect(listingCompletion({ price: 0, stockStatus: "in_stock", inventoryMode: "status_only", deliveryAvailable: true, pickupAvailable: true, branchId: "eca78e0f-1054-4c22-9d89-c36eba8d687c", listingStatus: "draft" }).readyToPublish).toBe(false);
    expect(listingCompletion({ price: 20, stockStatus: "out_of_stock", deliveryAvailable: true, pickupAvailable: true, listingStatus: "draft" }).readyToPublish).toBe(false);
    expect(listingCompletion({ price: 20, stockStatus: "in_stock", deliveryAvailable: false, pickupAvailable: false, listingStatus: "draft" }).readyToPublish).toBe(false);
    expect(listingCompletion({ price: 20, stockStatus: "in_stock", deliveryAvailable: true, pickupAvailable: false, listingStatus: "draft" }, false).readyToPublish).toBe(false);
    expect(listingCompletion({ price: 20, stockStatus: "in_stock", deliveryAvailable: true, pickupAvailable: false, branchId: null, listingStatus: "draft" }).needsBranch).toBe(true);
  });

  it("builds the supplier dashboard summary", () => {
    const summary = listingSummary([
      { price: null, stockStatus: "confirmation_required", inventoryMode: "confirmation_required", deliveryAvailable: true, pickupAvailable: true, listingStatus: "draft" },
      { price: 50, stockStatus: "in_stock", inventoryMode: "status_only", deliveryAvailable: true, pickupAvailable: false, branchId: "eca78e0f-1054-4c22-9d89-c36eba8d687c", listingStatus: "draft" },
      { price: 80, stockStatus: "in_stock", inventoryMode: "status_only", deliveryAvailable: true, pickupAvailable: true, branchId: "eca78e0f-1054-4c22-9d89-c36eba8d687c", listingStatus: "published" },
      { price: 80, stockStatus: "out_of_stock", deliveryAvailable: true, pickupAvailable: true, listingStatus: "out_of_stock" },
    ]);
    expect(summary).toEqual({ total: 4, draft: 2, ready: 1, published: 1, outOfStock: 1, priceMissing: 1, stockConfirmation: 1, needsBranch: 2 });
  });

  it("explains marketplace visibility without exposing draft or empty stock", () => {
    const base = { price: 20, stockStatus: "in_stock", deliveryAvailable: true, pickupAvailable: true, branchId: "branch", listingStatus: "published" };
    expect(marketplaceVisibility({ ...base, inventoryMode: "exact_quantity", stockQuantity: 2 })).toBe("Visible");
    expect(marketplaceVisibility({ ...base, inventoryMode: "exact_quantity", stockQuantity: 0 })).toBe("Hidden — No stock");
    expect(marketplaceVisibility({ ...base, inventoryMode: "confirmation_required", listingStatus: "draft" })).toBe("Hidden — Draft");
    expect(marketplaceVisibility(base, false)).toBe("Hidden — Supplier not approved");
  });

  it("keeps a blank price nullable for drafts and rejects it for publishing", () => {
    const base = { productId: "9b232d45-65f6-4f7d-83d5-d0907f98b4ff", sku: "", price: "", wholesalePrice: "", wholesaleMinimum: "", stockQuantity: "", stockStatus: "confirmation_required", leadTimeDays: 1, minimumOrderQuantity: "", deliveryAvailable: true, pickupAvailable: true, supplierNotes: "", branchId: "", warehouseId: "", isActive: false };
    const draft = listingSchema.safeParse({ ...base, listingStatus: "draft" });
    expect(draft.success).toBe(true);
    if (draft.success) expect(draft.data.price).toBeNull();
    expect(listingSchema.safeParse({ ...base, listingStatus: "published", isActive: true }).success).toBe(false);
  });
});

describe("supplier marketplace language", () => {
  const base = { price: 100, stockStatus: "in_stock", stockQuantity: 5, inventoryMode: "exact_quantity", deliveryAvailable: true, pickupAvailable: false, branchId: "branch", listingStatus: "published" };
  it("uses simple actionable statuses", () => {
    expect(supplierMarketplaceStatus(base)).toBe("Live");
    expect(supplierMarketplaceStatus({ ...base, stockQuantity: 0 })).toBe("Out of Stock");
    expect(supplierMarketplaceStatus({ ...base, price: null })).toBe("Needs Price");
    expect(supplierMarketplaceStatus({ ...base, listingStatus: "draft" })).toBe("Draft");
    expect(supplierMarketplaceStatus(base, false)).toBe("Awaiting Approval");
  });
});
