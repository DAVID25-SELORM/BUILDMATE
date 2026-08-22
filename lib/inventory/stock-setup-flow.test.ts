import { describe, expect, it } from "vitest";
import { selectStockSetupListing } from "./stock-setup-flow";

const listings = [
  { id: "bamboo", name: "Bamboo Construction Poles" },
  { id: "plywood", name: "Plywood" },
];

describe("supplier stock setup targeting", () => {
  it("opens the exact listing selected from an inventory row", () => {
    expect(
      selectStockSetupListing(listings, ["bamboo"], "bamboo")?.name,
    ).toBe("Bamboo Construction Poles");
  });

  it("advances only when the supplier starts the queue workflow", () => {
    expect(selectStockSetupListing(listings, ["bamboo"])?.name).toBe(
      "Plywood",
    );
  });

  it("finishes a row-targeted workflow instead of opening another product", () => {
    expect(
      selectStockSetupListing(listings, [], "bamboo", "bamboo"),
    ).toBeUndefined();
  });
});
