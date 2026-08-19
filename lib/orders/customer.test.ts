import { describe, expect, it } from "vitest";
import {
  customerOrderStatusLabel,
  customerOrderOwnership,
  customerPaymentStatus,
  isActiveCustomerOrder,
} from "@/lib/orders/customer";

describe("customer order presentation", () => {
  it("uses the canonical individual and organisation ownership scopes", () => {
    expect(customerOrderOwnership({ userId: "customer-a" })).toEqual({
      kind: "individual",
      userId: "customer-a",
    });
    expect(
      customerOrderOwnership({ userId: "member-a", organisationId: "org-a" }),
    ).toEqual({
      kind: "organisation",
      organisationId: "org-a",
    });
  });
  it("uses one active-order definition", () => {
    expect(isActiveCustomerOrder("awaiting_supplier_confirmation")).toBe(true);
    expect(isActiveCustomerOrder("awaiting_payment")).toBe(true);
    expect(isActiveCustomerOrder("partially_delivered")).toBe(true);
    expect(isActiveCustomerOrder("completed")).toBe(false);
    expect(isActiveCustomerOrder("cancelled")).toBe(false);
    expect(isActiveCustomerOrder("refunded")).toBe(false);
  });

  it("separates COD payment state from order state", () => {
    const order = {
      payment_method: "cash_on_delivery",
      order_cash_payments: [],
    };
    expect(customerOrderStatusLabel("awaiting_supplier_confirmation")).toBe(
      "Awaiting Supplier Confirmation",
    );
    expect(customerPaymentStatus(order)).toBe("Pending");
  });

  it("never exposes raw customer status enum labels", () => {
    expect(customerOrderStatusLabel("partially_delivered")).toBe(
      "Partially Delivered",
    );
    expect(customerOrderStatusLabel("customer_confirmation_pending")).toBe(
      "Delivered — Please Confirm",
    );
  });
});
