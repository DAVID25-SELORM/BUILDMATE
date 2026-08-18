import { describe, expect, it } from "vitest";
import {
  parseMaterialLines,
  rfqSchema,
  supplierQuoteSchema,
} from "./validation";
import { localDateValue } from "@/lib/dates/future";

describe("RFQ validation", () => {
  const today = localDateValue();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateValue(yesterdayDate);

  it("turns non-empty material lines into items", () =>
    expect(parseMaterialLines("50 bags cement\n\n20 rods")).toHaveLength(2));
  it("requires a delivery location", () =>
    expect(
      rfqSchema.safeParse({
        title: "House",
        deliveryLocation: "",
        requiredDate: "",
        materialList: "cement",
        notes: "",
      }).success,
    ).toBe(false));
  it("requires a non-past delivery date", () => {
    expect(
      rfqSchema.safeParse({
        title: "House",
        deliveryLocation: "Accra",
        requiredDate: yesterday,
        materialList: "cement",
        notes: "",
      }).success,
    ).toBe(false);
    expect(
      rfqSchema.safeParse({
        title: "House",
        deliveryLocation: "Accra",
        requiredDate: today,
        materialList: "cement",
        notes: "",
      }).success,
    ).toBe(true);
  });
  it("rejects negative quote totals", () =>
    expect(
      supplierQuoteSchema.safeParse({
        quoteRequestId: crypto.randomUUID(),
        subtotal: -1,
        deliveryFee: 0,
        validUntil: "",
        deliveryDays: 2,
        notes: "",
      }).success,
    ).toBe(false));
  it("rejects a supplier quote expiry in the past", () =>
    expect(
      supplierQuoteSchema.safeParse({
        quoteRequestId: crypto.randomUUID(),
        subtotal: 1,
        deliveryFee: 0,
        validUntil: yesterday,
        deliveryDays: 2,
        notes: "",
      }).success,
    ).toBe(false));
});
