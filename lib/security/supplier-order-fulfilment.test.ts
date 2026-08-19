import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "202608190065_supplier_order_fulfilment_workflow.sql",
  ),
  "utf8",
).toLowerCase();

describe("supplier COD fulfilment workflow", () => {
  it("requires acknowledgement before acceptance or rejection", () => {
    expect(sql).toContain("acknowledge the order before accepting it");
    expect(sql).toContain("o.supplier_received_at is null");
    expect(sql).toContain("orders.accept");
  });

  it("uses the existing confirmed transition for atomic inventory reservation", () => {
    expect(sql).toContain("new_status='confirmed'");
    expect(sql).not.toContain("sale_reservation");
  });

  it("creates delivery work only for delivery fulfilment", () => {
    expect(sql).toContain("o.fulfilment_method='delivery'");
    expect(sql).toContain("insert into deliveries");
    expect(sql).toContain("on conflict(order_id) do nothing");
  });

  it("records pickup cash separately and waits for customer confirmation", () => {
    expect(sql).toContain("supplier_complete_pickup");
    expect(sql).toContain("supplier_record_cash_payment");
    expect(sql).toContain("customer_confirmation_pending");
    expect(sql).toContain("cash_payment_recorded");
  });

  it("audits every supplier-controlled transition", () => {
    expect(sql).toContain("order_acknowledged");
    expect(sql).toContain("order_status_changed");
    expect(sql).toContain("order_rejected");
    expect(sql).toContain("pickup_handed_over");
  });
});
