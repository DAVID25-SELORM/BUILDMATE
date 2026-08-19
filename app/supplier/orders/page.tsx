import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  SupplierOrdersView,
  type SupplierOrderView,
} from "@/components/dashboard/PortalSectionViews";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { supplierNavigation } from "@/lib/organisations/navigation";
import { confirmReturnToOrigin, recordCashPayment } from "./actions";

export default async function SupplierOrders() {
  const { supabase, membership } =
    await requireSupplierPermission("orders.view");
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,order_number,status,total,delivery_address,fulfilment_method,payment_method,supplier_received_at,created_at,customer:profiles!orders_customer_id_fkey(full_name),order_items(product_name_snapshot,quantity,unit),order_cash_payments(recorded_at),deliveries(id,status)",
    )
    .eq("supplier_id", membership.organisationId)
    .order("created_at", { ascending: false });
  if (error)
    throw new Error(`Unable to load supplier orders: ${error.message}`);
  const orders = (data ?? []) as unknown as SupplierOrderView[];
  const rows = data ?? [];
  const returns = rows.flatMap((order) =>
    (order.deliveries ?? [])
      .filter((delivery) => delivery.status === "return_to_origin")
      .map((delivery) => ({ delivery, order })),
  );
  const awaitingCash = rows.filter(
    (order) =>
      order.status === "customer_confirmation_pending" &&
      ["cash_on_delivery", "cash_on_pickup"].includes(order.payment_method) &&
      !order.order_cash_payments?.length,
  );
  return (
    <DashboardShell
      title="Supplier portal"
      nav={await supplierNavigation(membership.organisationId)}
    >
      <SupplierOrdersView orders={orders} />
      {awaitingCash.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="text-xl font-black">
            Fulfilled orders awaiting cash record
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Record cash only after it is physically received. The customer must
            still confirm receipt.
          </p>
          <div className="mt-4 space-y-3">
            {awaitingCash.map((order) => (
              <form
                action={recordCashPayment.bind(null, order.id)}
                className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"
                key={order.id}
              >
                <div>
                  <b>{order.order_number}</b>
                  <p className="text-sm">
                    GHS {Number(order.total).toFixed(2)}
                  </p>
                </div>
                <input
                  className="input"
                  name="reference"
                  placeholder="Receipt/reference (optional)"
                />
                <button className="btn-primary">Record cash received</button>
              </form>
            ))}
          </div>
        </section>
      )}
      {returns.length > 0 && (
        <section className="card mt-6 p-5">
          <h2 className="text-xl font-black">
            Returns to origin awaiting confirmation
          </h2>
          <div className="mt-4 space-y-3">
            {returns.map(({ delivery, order }) => (
              <form
                action={confirmReturnToOrigin}
                className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"
                key={delivery.id}
              >
                <input type="hidden" name="delivery" value={delivery.id} />
                <b>{order.order_number}</b>
                <input
                  className="input"
                  name="reason"
                  minLength={5}
                  placeholder="Confirm goods returned and give reason"
                  required
                />
                <button className="btn-primary">Confirm return</button>
              </form>
            ))}
          </div>
        </section>
      )}
    </DashboardShell>
  );
}
