import { MetricCard } from "@/components/dashboard/MetricCard";

type CustomerOrder = {
  id?: string;
  order_number: string;
  status: string;
  total: number | string;
};

export function CustomerOverview({
  projects,
  openQuotes,
  orders,
}: {
  projects: number;
  openQuotes: number;
  orders: CustomerOrder[];
}) {
  const active = orders.filter(
    order => !["completed", "cancelled", "refunded"].includes(order.status),
  );
  const committed = active.reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <>
      <h1 className="text-3xl font-black">Account overview</h1>
      <p className="mt-2 text-slate-600">
        Live information from your BuildMate account.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Projects" value={String(projects)} detail="Saved projects" />
        <MetricCard
          label="Open RFQs"
          value={String(openQuotes)}
          detail="Awaiting supplier selection"
        />
        <MetricCard
          label="Active orders"
          value={String(active.length)}
          detail={`GHS ${committed.toFixed(2)} committed`}
        />
      </div>
      <div className="card mt-6 p-6">
        <h2 className="text-xl font-bold">Recent orders</h2>
        <div className="mt-4 divide-y">
          {orders.slice(0, 5).map((order, index) => (
            <div
              className="flex justify-between py-4 text-sm"
              key={order.id ?? `${order.order_number}-${index}`}
            >
              <span>{order.order_number}</span>
              <span className="capitalize">{order.status.replaceAll("_", " ")}</span>
            </div>
          ))}
          {!orders.length && (
            <p className="py-4 text-sm text-slate-500">No order activity yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
