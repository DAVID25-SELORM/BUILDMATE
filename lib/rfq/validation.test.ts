import { describe, expect, it } from "vitest";
import { parseMaterialLines, rfqSchema, supplierQuoteSchema } from "./validation";

describe("RFQ validation", () => {
  it("turns non-empty material lines into items", () => expect(parseMaterialLines("50 bags cement\n\n20 rods")).toHaveLength(2));
  it("requires a delivery location", () => expect(rfqSchema.safeParse({ title: "House", deliveryLocation: "", requiredDate: "", materialList: "cement", notes: "" }).success).toBe(false));
  it("rejects negative quote totals", () => expect(supplierQuoteSchema.safeParse({ quoteRequestId: crypto.randomUUID(), subtotal: -1, deliveryFee: 0, validUntil: "", deliveryDays: 2, notes: "" }).success).toBe(false));
});
