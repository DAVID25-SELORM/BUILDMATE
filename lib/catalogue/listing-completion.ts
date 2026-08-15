export type ListingCompletionInput = {
  price: number | string | null;
  stockStatus: string;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  branchId?: string | null;
  listingStatus: string;
};

export function listingCompletion(input: ListingCompletionInput, supplierCanPublish = true) {
  const needsPrice = input.price == null || input.price === "" || Number(input.price) < 0;
  const needsStockConfirmation = input.stockStatus === "confirmation_required";
  const hasFulfilment = input.deliveryAvailable || input.pickupAvailable;
  const needsBranch = !input.branchId;
  const validAvailability = input.stockStatus !== "out_of_stock";
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
