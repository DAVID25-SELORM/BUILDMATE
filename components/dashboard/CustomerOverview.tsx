import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProductCard, type Product } from "@/components/commerce/ProductCard";
import Link from "next/link";

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
  products = [],
}: {
  projects: number;
  openQuotes: number;
  orders: CustomerOrder[];
  products?: Product[];
}) {
  const active = orders.filter(
    (order) => !["completed", "cancelled", "refunded"].includes(order.status),
  );
  const committed = active.reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <>
      <h1 className="text-3xl font-black">Find materials for your project</h1>
      <p className="mt-2 text-slate-600">
        Start with a product, then compare offers from verified suppliers.
      </p>
      <form action="/shop" className="card mt-5 flex gap-3 p-4">
        <label className="flex-1">
          <span className="sr-only">Search materials</span>
          <input
            className="input"
            name="q"
            placeholder="Search plywood, cement, roofing..."
          />
        </label>
        <button className="btn-primary">Search</button>
      </form>
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-2xl font-black">Available materials</h2>
        <Link href="/shop" className="font-semibold text-brand-700">
          Continue shopping
        </Link>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard
            key={product.productId ?? product.name}
            product={product}
          />
        ))}
      </div>
      <h2 className="mt-10 text-2xl font-black">Your activity</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Projects"
          value={String(projects)}
          detail="Saved projects"
        />
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
              <span className="capitalize">
                {order.status.replaceAll("_", " ")}
              </span>
            </div>
          ))}
          {!orders.length && (
            <div className="py-4 text-sm text-slate-500">
              <p>No order activity yet.</p>
              <Link
                href="/shop"
                className="mt-2 inline-block font-semibold text-brand-700"
              >
                Start shopping
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
