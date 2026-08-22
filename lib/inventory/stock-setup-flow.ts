export type StockSetupCandidate = { id: string };

export function selectStockSetupListing<T extends StockSetupCandidate>(
  listings: T[],
  handledIds: string[],
  requestedId?: string,
  completedRequestedId?: string,
) {
  if (requestedId) {
    if (completedRequestedId === requestedId) return undefined;
    return listings.find((listing) => listing.id === requestedId);
  }
  return listings.find((listing) => !handledIds.includes(listing.id));
}
