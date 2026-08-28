import Link from "next/link";
import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PayButton } from "@/components/commerce/PayButton";
import { OrderActions } from "@/components/commerce/OrderActions";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCustomerOrganisationMembership } from "@/lib/organisations/access";
import { customerNavigation } from "@/lib/organisations/navigation";
import { hasPermission } from "@/lib/auth/permissions";
import { getCustomerOrder } from "@/lib/orders/customer";
const labels: Record<string, string> = {
  awaiting_supplier_confirmation: "Awaiting Supplier Confirmation",
  confirmed: "Order Accepted",
  preparing: "Preparing",
  ready_for_dispatch: "Ready for Dispatch",
  driver_assigned: "Driver Assigned",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  partially_delivered: "Partially Delivered",
  customer_confirmation_pending: "Delivered — Check Materials",
  completed: "Completed",
  cancelled: "Supplier Unable to Fulfil",
};
const timeline = [
  "submitted",
  "received_by_supplier",
  "confirmed",
  "preparing",
  "ready_for_dispatch",
  "in_transit",
  "customer_confirmation_pending",
  "completed",
];
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { id } = await params;
  const { submitted } = await searchParams;
  const { user } = await requireUser();
  const s = await createClient();
  const { membership } = await getCustomerOrganisationMembership();
  const organisationId = membership?.organisation_id;
  const [o, { data: events, error: eventsError }] = await Promise.all([
    getCustomerOrder(id, { userId: user.id, organisationId }),
    s
      .from("order_events")
      .select("event_type,note,created_at")
      .eq("order_id", id)
      .order("created_at"),
  ]);
  if (!o) notFound();
  if (eventsError)
    throw new Error(`Unable to load order timeline: ${eventsError.message}`);
  const canPay =
    !organisationId ||
    (await hasPermission({ permission: "payments.initiate", organisationId }));
  const eventMap = new Map(
    (events ?? []).map((event) => [event.event_type, event]),
  );
  const cod =
    o.payment_method === "cash_on_delivery" ||
    o.payment_method === "cash_on_pickup";
  return (
    <DashboardShell
      title="Customer workspace"
      nav={await customerNavigation(organisationId)}
    >
      {submitted === "1" && (
        <section className="rounded-2xl bg-emerald-50 p-6">
          <CheckCircle2 className="h-9 w-9 text-emerald-700" />
          <h1 className="mt-3 text-3xl font-black">Order submitted</h1>
          <p className="mt-2">
            Your order has been sent to{" "}
            {(o.supplier as unknown as { name: string } | null)?.name ??
              "the supplier"}
            .
          </p>
        </section>
      )}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{o.order_number}</h1>
          <p className="mt-2 font-semibold text-brand-800">
            {labels[o.status] ?? o.status.replaceAll("_", " ")}
          </p>
        </div>
        <Link href="/shop" className="btn-secondary">
          Continue shopping
        </Link>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="card p-6">
            {o.order_items.map(
              (item: {
                product_name_snapshot: string;
                line_total: number;
                quantity: number;
                unit: string;
              }) => (
                <div
                  className="flex justify-between border-b py-3"
                  key={item.product_name_snapshot}
                >
                  <span>
                    {item.product_name_snapshot}
                    <small className="block text-slate-500">
                      {item.quantity} {item.unit}
                    </small>
                  </span>
                  <b>GHS {Number(item.line_total).toFixed(2)}</b>
                </div>
              ),
            )}
            <div className="mt-4 flex justify-between text-xl font-black">
              <span>Total</span>
              <span>GHS {Number(o.total).toFixed(2)}</span>
            </div>
          </div>
          {o.rejection_reason && (
            <div className="mt-5 rounded-xl bg-red-50 p-5">
              <h2 className="font-black text-red-900">
                Supplier unable to fulfil order
              </h2>
              <p className="mt-2 text-red-800">{o.rejection_reason}</p>
              <div className="mt-4 flex gap-3">
                <Link href="/shop" className="btn-secondary">
                  Find another supplier
                </Link>
                <a href="/request-quote" data-navigation="document" className="btn-primary">
                  Request quote
                </a>
              </div>
            </div>
          )}
          <OrderActions id={o.id} status={o.status} />
          {o.status === "awaiting_payment" && !cod && canPay && (
            <div className="mt-5 max-w-sm">
              <PayButton orderId={o.id} />
            </div>
          )}
        </div>
        <aside className="space-y-5">
          <div className="card p-5">
            <h2 className="font-black">Order details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Supplier</dt>
                <dd className="font-semibold">
                  {(o.supplier as unknown as { name: string } | null)?.name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Fulfilment</dt>
                <dd className="font-semibold capitalize">
                  {o.fulfilment_method}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Payment</dt>
                <dd className="font-semibold">
                  {o.payment_method === "cash_on_pickup"
                    ? "Cash on Pickup"
                    : o.payment_method === "cash_on_delivery"
                      ? "Cash on Delivery"
                      : "Online payment"}
                </dd>
              </div>
            </dl>
            {cod && (
              <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
                <p className="flex gap-2 font-black">
                  <ShieldCheck className="h-5 w-5" />
                  Do not pay until you receive and verify your materials.
                </p>
              </div>
            )}
          </div>
          <div className="card p-5">
            <h2 className="font-black">Order timeline</h2>
            <ol className="mt-4 space-y-4">
              {timeline.map((step) => {
                const event = eventMap.get(step);
                const complete = Boolean(event);
                return (
                  <li className="flex gap-3" key={step}>
                    {complete ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-700" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                    )}
                    <div>
                      <p
                        className={
                          complete ? "font-semibold" : "text-slate-500"
                        }
                      >
                        {labels[step] ?? step.replaceAll("_", " ")}
                      </p>
                      {event && (
                        <p className="text-xs text-slate-500">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
