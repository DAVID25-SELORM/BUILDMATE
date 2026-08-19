import { createClient } from "@/lib/supabase/server";

type CustomerOrderContext = {
  userId: string;
  organisationId?: string;
};

export type CustomerOrder = {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  created_at?: string;
  updated_at?: string;
  fulfilment_method?: string | null;
  payment_method?: string | null;
  supplier?: { name: string } | null;
  order_cash_payments?: {
    recorded_at: string;
    customer_confirmed_at: string | null;
  }[];
};

export const inactiveCustomerOrderStatuses = [
  "completed",
  "cancelled",
  "refunded",
] as const;

export function isActiveCustomerOrder(status: string) {
  return !inactiveCustomerOrderStatuses.includes(
    status as (typeof inactiveCustomerOrderStatuses)[number],
  );
}

export function customerOrderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    awaiting_payment: "Awaiting Payment",
    awaiting_supplier_confirmation: "Awaiting Supplier Confirmation",
    supplier_received: "Received by Supplier",
    confirmed: "Order Accepted",
    preparing: "Preparing Order",
    ready_for_dispatch: "Ready for Dispatch",
    driver_assigned: "Driver Assigned",
    picked_up: "Picked Up",
    in_transit: "In Transit",
    partially_delivered: "Partially Delivered",
    customer_confirmation_pending: "Delivered — Please Confirm",
    delivered: "Delivered — Please Confirm",
    completed: "Completed",
    disputed: "Under Review",
    refunded: "Refunded",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function customerPaymentLabel(
  order: Pick<CustomerOrder, "payment_method" | "order_cash_payments">,
) {
  if (order.payment_method === "cash_on_delivery") return "Cash on Delivery";
  if (order.payment_method === "cash_on_pickup") return "Cash on Pickup";
  return "Online payment";
}

export function customerPaymentStatus(
  order: Pick<CustomerOrder, "payment_method" | "order_cash_payments">,
) {
  const cash = order.order_cash_payments?.[0];
  if (
    order.payment_method === "cash_on_delivery" ||
    order.payment_method === "cash_on_pickup"
  ) {
    return cash?.customer_confirmed_at
      ? "Confirmed"
      : cash?.recorded_at
        ? "Received — confirmation pending"
        : "Pending";
  }
  return "Pending";
}

export function customerOrderOwnership(context: CustomerOrderContext) {
  return context.organisationId
    ? { kind: "organisation" as const, organisationId: context.organisationId }
    : { kind: "individual" as const, userId: context.userId };
}

const customerOrderListSelect = `
  id,order_number,status,total,created_at,updated_at,fulfilment_method,payment_method,
  supplier:organisations!orders_supplier_id_fkey(name),
  order_cash_payments(recorded_at,customer_confirmed_at)
`;

export async function getCustomerOrders(context: CustomerOrderContext) {
  const supabase = await createClient();
  const ownership = customerOrderOwnership(context);
  let query = supabase
    .from("orders")
    .select(customerOrderListSelect)
    .order("updated_at", { ascending: false });
  query =
    ownership.kind === "organisation"
      ? query.eq("customer_organisation_id", ownership.organisationId)
      : query
          .eq("customer_id", ownership.userId)
          .is("customer_organisation_id", null);
  const { data, error } = await query;
  if (error)
    throw new Error(`Unable to load customer orders: ${error.message}`);
  return (data ?? []) as unknown as CustomerOrder[];
}

export async function getCustomerOrder(
  orderId: string,
  context: CustomerOrderContext,
) {
  const supabase = await createClient();
  const ownership = customerOrderOwnership(context);
  let query = supabase
    .from("orders")
    .select(
      `*,supplier:organisations!orders_supplier_id_fkey(name),order_items(product_name_snapshot,line_total,quantity,unit),order_cash_payments(recorded_at,customer_confirmed_at)`,
    )
    .eq("id", orderId);
  query =
    ownership.kind === "organisation"
      ? query.eq("customer_organisation_id", ownership.organisationId)
      : query
          .eq("customer_id", ownership.userId)
          .is("customer_organisation_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Unable to load customer order: ${error.message}`);
  return data;
}
