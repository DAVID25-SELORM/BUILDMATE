export const LISTING_STATUSES = ["draft", "published", "out_of_stock", "seasonal", "discontinued", "suspended"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export function canPublishListing(input: {
  price: number | null;
  stockStatus: string;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
}) {
  return input.price !== null && input.price >= 0 && input.stockStatus !== "out_of_stock" && (input.deliveryAvailable || input.pickupAvailable);
}

export function listingStatusLabel(status: ListingStatus) {
  return status.replaceAll("_", " ");
}
