import { describe, expect, it } from "vitest";
import { canPublishListing, listingStatusLabel } from "./listing-status";

describe("supplier listing lifecycle", () => {
  it("requires price, fulfilment and available stock mode before publishing", () => {
    expect(canPublishListing({ price: 110, stockStatus: "in_stock", deliveryAvailable: true, pickupAvailable: false })).toBe(true);
    expect(canPublishListing({ price: null, stockStatus: "in_stock", deliveryAvailable: true, pickupAvailable: true })).toBe(false);
    expect(canPublishListing({ price: 110, stockStatus: "out_of_stock", deliveryAvailable: true, pickupAvailable: true })).toBe(false);
    expect(canPublishListing({ price: 110, stockStatus: "in_stock", deliveryAvailable: false, pickupAvailable: false })).toBe(false);
  });

  it("formats lifecycle labels", () => expect(listingStatusLabel("out_of_stock")).toBe("out of stock"));
});
