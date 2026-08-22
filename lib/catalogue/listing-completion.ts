export type ListingCompletionInput = {
  price: number | string | null;
  stockStatus: string;
  stockQuantity?: number | string | null;
  inventoryMode?: string | null;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  branchId?: string | null;
  listingStatus: string;
};

export function listingCompletion(input: ListingCompletionInput, supplierCanPublish = true) {
  const needsPrice = input.price == null || input.price === "" || Number(input.price) <= 0;
  const needsStockConfirmation = input.stockStatus === "confirmation_required";
  const hasFulfilment = input.deliveryAvailable || input.pickupAvailable;
  const needsBranch = !input.branchId;
  const validAvailability =
    input.inventoryMode === "exact_quantity"
      ? input.stockQuantity != null && Number(input.stockQuantity) > 0
      : input.inventoryMode === "status_only"
        ? input.stockStatus === "in_stock"
        : false;
  const needsAvailability = !hasFulfilment || !validAvailability;
  const readyToPublish = supplierCanPublish && !needsPrice && !needsBranch && !needsAvailability;

  return {
    needsPrice,
    needsStockConfirmation,
    needsAvailability,
    needsBranch,
    readyToPublish,
    published: input.listingStatus === "published",
  };
}

export function marketplaceVisibility(
  input: ListingCompletionInput,
  supplierCanPublish = true,
) {
  if (!supplierCanPublish) return "Hidden — Supplier not approved";
  if (input.listingStatus !== "published") return "Hidden — Draft";
  if (!input.branchId) return "Hidden — No branch";
  if (input.price == null || input.price === "" || Number(input.price) <= 0)
    return "Hidden — Needs price";
  if (
    input.inventoryMode === "exact_quantity" &&
    (input.stockQuantity == null || Number(input.stockQuantity) <= 0)
  )
    return "Hidden — No stock";
  if (
    input.inventoryMode !== "exact_quantity" &&
    !(input.inventoryMode === "status_only" && input.stockStatus === "in_stock")
  )
    return "Hidden — Needs stock setup";
  return "Visible";
}

export function listingSummary(listings: ListingCompletionInput[], supplierCanPublish = true) {
  const states = listings.map((listing) => listingCompletion(listing, supplierCanPublish));
  return {
    total: listings.length,
    draft: listings.filter((listing) => listing.listingStatus === "draft").length,
    ready: states.filter((state) => state.readyToPublish && !state.published).length,
    published: states.filter((state) => state.published).length,
    outOfStock: listings.filter((listing) => listing.stockStatus === "out_of_stock" || listing.listingStatus === "out_of_stock").length,
    priceMissing: states.filter((state) => state.needsPrice).length,
    stockConfirmation: states.filter((state) => state.needsStockConfirmation).length,
    needsBranch: states.filter((state) => state.needsBranch).length,
  };
}
