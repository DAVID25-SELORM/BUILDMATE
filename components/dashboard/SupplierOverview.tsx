import { MetricCard } from "@/components/dashboard/MetricCard";

type SupplierOrder = {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
};

export function SupplierOverview({
  orders,
  activeListings,
  quoteStatuses,
}: {
  orders: SupplierOrder[];
  activeListings: number;
  quoteStatuses: string[];
}) {
  const completed = orders.filter(order => order.status === "completed");
  const revenue = completed.reduce((sum, order) => sum + Number(order.total), 0);
  const active = orders.filter(
    order => !["completed", "cancelled", "refunded"].includes(order.status),
  );
  const won = quoteStatuses.filter(status => status === "accepted").length;

  return (
    <>
      <h1 className="text-3xl font-black">Supplier overview</h1>
      <p className="mt-2 text-slate-600">
        Live trading and fulfilment information.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Completed revenue"
          value={`GHS ${revenue.toFixed(2)}`}
          detail="Recorded completed orders"
        />
        <MetricCard
          label="Open orders"
          value={String(active.length)}
          detail="Require fulfilment"
        />
        <MetricCard
          label="Quote win rate"
          value={quoteStatuses.length ? `${Math.round((won / quoteStatuses.length) * 100)}%` : "—"}
          detail={`${quoteStatuses.length} quotations submitted`}
        />
        <MetricCard
          label="Active listings"
          value={String(activeListings)}
          detail="Visible catalogue offers"
        />
      </div>
      <div className="card mt-6 p-6">
        <h2 className="text-xl font-bold">Recent orders</h2>
        <div className="mt-4 divide-y">
          {orders.slice(0, 5).map(order => (
            <div className="flex justify-between py-4 text-sm" key={order.id}>
              <span>{order.order_number}</span>
              <span className="capitalize">
                {order.status.replaceAll("_", " ")} · GHS {Number(order.total).toFixed(2)}
              </span>
            </div>
          ))}
          {!orders.length && <p className="py-4 text-sm text-slate-500">No orders yet.</p>}
        </div>
      </div>
    </>
  );
}
