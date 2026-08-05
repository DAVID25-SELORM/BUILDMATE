import { describe, expect, it } from "vitest";
import {
  customerFilterArgs,
  performanceRating,
  supplierFilterArgs,
  supplierPerformanceScore,
} from "./management";
describe("admin management filters", () => {
  it("maps all customer filters and clamps the page", () =>
    expect(
      customerFilterArgs(
        {
          q: "Ama",
          type: "contractor",
          status: "suspended",
          region: "Greater Accra",
          from: "2026-01-01",
          to: "2026-02-01",
          minSpend: "500",
          sort: "highest_spending",
        },
        0,
      ),
    ).toMatchObject({
      search_text: "Ama",
      role_filter: "contractor",
      status_filter: "suspended",
      region_filter: "Greater Accra",
      registered_from: "2026-01-01",
      registered_to: "2026-02-01",
      min_spend: 500,
      sort_by: "highest_spending",
      page_number: 1,
    }));
  it("maps supplier verification, category, performance and date filters", () =>
    expect(
      supplierFilterArgs({
        verification: "tax_verified",
        category: "Cement",
        performance: "high_risk",
        from: "2026-01-01",
        to: "2026-03-01",
      }),
    ).toMatchObject({
      verification_level_filter: "tax_verified",
      category_filter: "Cement",
      performance_filter: "high_risk",
      registered_from: "2026-01-01",
      registered_to: "2026-03-01",
    }));
  it("rejects unknown sort values", () =>
    expect(supplierFilterArgs({ sort: "drop table" }).sort_by).toBe("newest"));
});
describe("supplier performance calculation", () => {
  it("uses all ten weighted components", () =>
    expect(
      supplierPerformanceScore({
        acceptance: 80,
        quotationResponse: 70,
        fulfilment: 90,
        cancellation: 5,
        returns: 4,
        disputes: 3,
        onTime: 85,
        averageRating: 4.5,
        stockUpdates: 75,
        productAccuracy: 95,
      }),
    ).toBe(87.8));
  it.each([
    [90, "excellent"],
    [75, "good"],
    [55, "needs_attention"],
    [20, "high_risk"],
  ] as const)("classifies %s as %s", (score, rating) =>
    expect(performanceRating(score)).toBe(rating),
  );
  it("clamps invalid component values", () =>
    expect(
      supplierPerformanceScore({
        acceptance: 200,
        quotationResponse: -20,
        fulfilment: 100,
        cancellation: -1,
        returns: 0,
        disputes: 0,
        onTime: 100,
        averageRating: 8,
        stockUpdates: 100,
        productAccuracy: 100,
      }),
    ).toBe(90));
});
