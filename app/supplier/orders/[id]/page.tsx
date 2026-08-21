import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { customerOrderStatusLabel } from "@/lib/orders/customer";
import {
  acknowledgeOrder,
  completePickup,
  progressOrder,
  rejectOrder,
} from "../actions";

type Item = {
  id: string;
  product_name_snapshot: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  supplier_listings: {
    inventory_mode: string;
    stock_status: string;
    inventory_balances: {
      available_quantity: number;
      quantity_reserved: number;
    }[];
  } | null;
};
type Event = {
  id: string;
  event_type: string;
  note: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

export default async function SupplierOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, membership } =
    await requireSupplierPermission("orders.view");
  const [{ data: order, error }, { data: events, error: eventError }] =
    await Promise.all([
      supabase
        .from("orders")
        .select(
          "id,order_number,status,total,created_at,delivery_address,fulfilment_method,payment_method,supplier_received_at,rejection_reason,customer:profiles!orders_customer_id_fkey(full_name,phone),order_items(id,product_name_snapshot,quantity,unit,unit_price,line_total,supplier_listings(inventory_mode,stock_status,inventory_balances(available_quantity,quantity_reserved))),order_cash_payments(recorded_at,reference)",
        )
        .eq("id", id)
        .eq("supplier_id", membership.organisationId)
        .maybeSingle(),
      supabase
        .from("order_events")
        .select("id,event_type,note,created_at,profiles(full_name)")
        .eq("order_id", id)
        .order("created_at"),
    ]);
  if (error) throw new Error(`Unable to load supplier order: ${error.message}`);
  if (eventError)
    throw new Error(`Unable to load order timeline: ${eventError.message}`);
  if (!order) notFound();
  const customer = order.customer as unknown as {
    full_name: string | null;
    phone: string | null;
  } | null;
  const items = order.order_items as unknown as Item[];
  const history = (events ?? []) as unknown as Event[];
  const acknowledged = Boolean(order.supplier_received_at);
  const paymentRecorded = Boolean(order.order_cash_payments?.length);
  const status =
    order.status === "awaiting_supplier_confirmation"
      ? acknowledged
        ? "Received — decision required"
        : "New Order"
      : order.status === "ready_for_dispatch"
        ? order.fulfilment_method === "pickup"
          ? "Ready for Pickup"
          : "Ready for Dispatch"
        : customerOrderStatusLabel(order.status);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/supplier/orders"
            className="text-sm font-semibold text-brand-700"
          >
            ← All orders
          </Link>
          <h1 className="mt-2 text-3xl font-black">{order.order_number}</h1>
          <p className="mt-1 font-semibold text-brand-800">{status}</p>
        </div>
        <b className="text-2xl">GHS {Number(order.total).toFixed(2)}</b>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <main className="space-y-5">
          <section className="card p-5">
            <h2 className="text-xl font-black">Items</h2>
            <div className="mt-3 divide-y">
              {items.map((item) => {
                const listing = item.supplier_listings,
                  balance = listing?.inventory_balances?.[0];
                return (
                  <div
                    className="grid gap-2 py-4 sm:grid-cols-[1fr_auto]"
                    key={item.id}
                  >
                    <div>
                      <b>{item.product_name_snapshot}</b>
                      <p className="text-sm text-slate-600">
                        {item.quantity} {item.unit} × GHS{" "}
                        {Number(item.unit_price).toFixed(2)}
                      </p>
                      {listing && (
                        <p className="mt-1 text-xs text-brand-700">
                          Availability:{" "}
                          {listing.inventory_mode === "confirmation_required"
                            ? "Supplier confirmation required"
                            : `${balance?.available_quantity ?? 0} available · ${balance?.quantity_reserved ?? 0} reserved`}
                        </p>
                      )}
                    </div>
                    <b>GHS {Number(item.line_total).toFixed(2)}</b>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card p-5">
            <h2 className="text-xl font-black">Next action</h2>
            <p className="mt-2 text-sm text-slate-600">
              Only the next server-authorised action is available.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {order.status === "awaiting_supplier_confirmation" &&
                !acknowledged && (
                  <form action={acknowledgeOrder.bind(null, order.id)}>
                    <button className="btn-primary">Acknowledge Order</button>
                  </form>
                )}
              {order.status === "awaiting_supplier_confirmation" &&
                acknowledged && (
                  <form
                    action={progressOrder.bind(null, order.id, "confirmed")}
                  >
                    <button className="btn-primary">Accept Order</button>
                  </form>
                )}
              {order.status === "confirmed" && (
                <form action={progressOrder.bind(null, order.id, "preparing")}>
                  <button className="btn-primary">Start Preparing</button>
                </form>
              )}
              {order.status === "preparing" && (
                <form
                  action={progressOrder.bind(
                    null,
                    order.id,
                    "ready_for_dispatch",
                  )}
                >
                  <button className="btn-primary">
                    {order.fulfilment_method === "pickup"
                      ? "Mark Ready for Pickup"
                      : "Mark Ready for Dispatch"}
                  </button>
                </form>
              )}
              {order.status === "ready_for_dispatch" &&
                order.fulfilment_method === "pickup" && (
                  <form
                    action={completePickup.bind(null, order.id)}
                    className="flex flex-wrap gap-2"
                  >
                    <input
                      className="input"
                      name="reference"
                      placeholder="Cash receipt/reference (optional)"
                    />
                    <button className="btn-primary">
                      Confirm Handover & Cash
                    </button>
                  </form>
                )}
              {order.status === "ready_for_dispatch" &&
                order.fulfilment_method === "delivery" && (
                  <div className="rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                    Ready for delivery assignment. Continue through the
                    canonical delivery workflow.
                  </div>
                )}
            </div>
            {order.status === "awaiting_supplier_confirmation" &&
              acknowledged && (
                <details className="mt-5">
                  <summary className="cursor-pointer font-semibold text-red-700">
                    Reject order
                  </summary>
                  <form
                    className="mt-3 flex gap-2"
                    action={rejectOrder.bind(null, order.id)}
                  >
                    <input
                      className="input"
                      name="reason"
                      required
                      minLength={5}
                      placeholder="Detailed reason"
                    />
                    <button className="btn-secondary">Reject</button>
                  </form>
                </details>
              )}
          </section>
        </main>
        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="font-black">Customer & fulfilment</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Customer</dt>
                <dd className="font-semibold">
                  {customer?.full_name ?? "Customer"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Phone</dt>
                <dd className="font-semibold">
                  {customer?.phone ?? "Not provided"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Method</dt>
                <dd className="font-semibold capitalize">
                  {order.fulfilment_method}
                </dd>
              </div>
              {order.fulfilment_method === "delivery" && (
                <div>
                  <dt className="text-slate-500">Delivery location</dt>
                  <dd className="font-semibold">{order.delivery_address}</dd>
                </div>
              )}
            </dl>
          </section>
          <section className="rounded-2xl bg-amber-50 p-5 text-amber-950">
            <h2 className="font-black">Payment policy</h2>
            <p className="mt-2 text-sm">
              {order.payment_method === "cash_on_pickup"
                ? "Cash on Pickup"
                : "Cash on Delivery"}{" "}
              — {paymentRecorded ? "Recorded" : "Pending"}. Do not request
              advance payment outside BuildMate.
            </p>
          </section>
          <section className="card p-5">
            <h2 className="font-black">Timeline</h2>
            <ol className="mt-3 space-y-3">
              {history.map((event) => (
                <li
                  className="border-l-2 border-brand-500 pl-3 text-sm"
                  key={event.id}
                >
                  <b>{customerOrderStatusLabel(event.event_type)}</b>
                  <p className="text-xs text-slate-500">
                    {new Date(event.created_at).toLocaleString()}
                    {event.profiles?.full_name
                      ? ` · ${event.profiles.full_name}`
                      : ""}
                  </p>
                  {event.note && <p>{event.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
