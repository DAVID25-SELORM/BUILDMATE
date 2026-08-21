import { log } from "@/lib/observability/logger";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SupplierOrderDetailItem = {
  id: string;
  listing_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  listing: { inventory_mode: string; stock_status: string; available: number | null; reserved: number | null } | null;
};
export type SupplierOrderDetailEvent = { id: string; event_type: string; note: string | null; created_at: string; actor: string | null };
export type SupplierOrderDetailResult = {
  order: Record<string, unknown> & { id: string; order_number: string; status: string; total: number; supplier_received_at: string | null; fulfilment_method: string; payment_method: string; delivery_address: string; created_at: string; customer: unknown };
  items: SupplierOrderDetailItem[];
  events: SupplierOrderDetailEvent[];
  payment: { recorded_at: string } | null;
  delivery: Record<string, unknown> | null;
};

export class SupplierOrderLoadError extends Error {
  constructor(public category: "query" | "invalid_identifier", message: string) { super(message); }
}

export async function getSupplierOrderDetail({ supabase, orderId, organisationId }: { supabase: Supabase; orderId: string; organisationId: string }): Promise<SupplierOrderDetailResult | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) return null;
  const { data: order, error: orderError } = await supabase.from("orders").select("id,order_number,status,total,created_at,delivery_address,fulfilment_method,payment_method,supplier_received_at,rejection_reason,customer:profiles!orders_customer_id_fkey(full_name,phone)").eq("id", orderId).eq("supplier_id", organisationId).maybeSingle();
  if (orderError) return fail("order", orderError.message, orderId, organisationId);
  if (!order) return null;

  const [{ data: rawItems, error: itemError }, { data: rawEvents, error: eventError }, { data: payments, error: paymentError }, { data: deliveries, error: deliveryError }] = await Promise.all([
    supabase.from("order_items").select("id,listing_id,product_name_snapshot,quantity,unit,unit_price,line_total").eq("order_id", orderId),
    supabase.from("order_events").select("id,event_type,note,created_at,profiles(full_name)").eq("order_id", orderId).order("created_at"),
    supabase.from("order_cash_payments").select("recorded_at").eq("order_id", orderId).limit(1),
    supabase.from("deliveries").select("id,status,delivery_location,assigned_at,picked_up_at,delivered_at").eq("order_id", orderId).limit(1),
  ]);
  const relatedError = itemError ?? eventError ?? paymentError ?? deliveryError;
  if (relatedError) return fail("related", relatedError.message, orderId, organisationId);
  const listingIds = [...new Set((rawItems ?? []).map((item) => item.listing_id).filter(Boolean))] as string[];
  const { data: listings, error: listingError } = listingIds.length ? await supabase.from("supplier_listings").select("id,inventory_mode,stock_status,inventory_balances(available_quantity,quantity_reserved)").in("id", listingIds).eq("supplier_id", organisationId) : { data: [], error: null };
  if (listingError) return fail("inventory", listingError.message, orderId, organisationId);
  const listingMap = new Map((listings ?? []).map((listing) => [listing.id, listing]));
  const items = (rawItems ?? []).map((item) => {
    const listing = item.listing_id ? listingMap.get(item.listing_id) : null;
    const balances = (listing?.inventory_balances ?? []) as { available_quantity: number; quantity_reserved: number }[];
    return { ...item, listing: listing ? { inventory_mode: listing.inventory_mode, stock_status: listing.stock_status, available: balances.length ? balances.reduce((sum, row) => sum + Number(row.available_quantity), 0) : null, reserved: balances.length ? balances.reduce((sum, row) => sum + Number(row.quantity_reserved), 0) : null } : null };
  }) as SupplierOrderDetailItem[];
  const events = (rawEvents ?? []).map((event) => ({ id: event.id, event_type: event.event_type, note: event.note, created_at: event.created_at, actor: Array.isArray(event.profiles) ? event.profiles[0]?.full_name ?? null : (event.profiles as { full_name?: string } | null)?.full_name ?? null }));
  return { order: order as SupplierOrderDetailResult["order"], items, events, payment: payments?.[0] ?? null, delivery: deliveries?.[0] ?? null };
}

function fail(stage: string, message: string, orderId: string, organisationId: string): never {
  log("error", "Supplier order detail load failed", { route: "/supplier/orders/[id]", orderId, organisationId, category: stage, databaseError: message });
  throw new SupplierOrderLoadError("query", "We couldn't load this order. Please try again.");
}
