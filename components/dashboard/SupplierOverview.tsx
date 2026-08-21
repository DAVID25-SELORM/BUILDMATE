import Link from "next/link";
import { ArrowRight, Boxes, PackageCheck, ShoppingBag } from "lucide-react";
import { MetricCard } from "@/components/supplier/dashboard/MetricCard";
import { SupplierPageHeader } from "@/components/supplier/SupplierPageHeader";
import { StatusBadge } from "@/components/supplier/StatusBadge";

type SupplierOrder = {
  id: string;
  order_number: string;
  status: string;
  total: number | string;
  created_at?: string;
  customer?:
    { full_name: string | null } | { full_name: string | null }[] | null;
};
const money = (value: number | null | undefined) =>
  value == null ? "Restricted" : `GHS ${Number(value).toFixed(2)}`;
const statusLabel = (status: string) =>
  status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export function SupplierOverview({
  orders,
  activeListings,
  quoteStatuses,
  financials,
  organisationName,
  previewBase,
}: {
  orders: SupplierOrder[];
  activeListings: number;
  quoteStatuses: string[];
  financials?: Record<string, number | null>;
  organisationName?: string;
  previewBase?: string;
}) {
  const portalHref = (path: string) =>
    previewBase ? path.replace("/supplier", previewBase) : path;
  const active = orders.filter(
    (order) => !["completed", "cancelled", "refunded"].includes(order.status),
  );
  const newOrders = orders.filter(
    (order) => order.status === "awaiting_supplier_confirmation",
  );
  const won = quoteStatuses.filter((status) => status === "accepted").length;
  const stockAttention =
    Number(financials?.low_stock ?? 0) + Number(financials?.out_of_stock ?? 0);
  const secondary = [
    ["Open orders", active.length],
    ["Active listings", activeListings],
    [
      "Quote win rate",
      quoteStatuses.length
        ? `${Math.round((won / quoteStatuses.length) * 100)}%`
        : "—",
    ],
    ["Low stock", financials?.low_stock ?? 0],
    ["Reserved stock", financials?.reserved_stock ?? 0],
    ["Returns awaiting review", financials?.returns_pending ?? 0],
  ];
  return (
    <>
      <SupplierPageHeader
        title="Supplier overview"
        description={`Good day, ${organisationName ?? "supplier"}. Here’s what needs your attention today.`}
        actions={
          <>
            <Link
              className="btn-secondary min-h-11 px-4 py-2 text-sm"
              href={portalHref("/supplier/orders")}
            >
              View orders
            </Link>
            <Link
              className="btn-primary min-h-11 bg-emerald-800 px-4 py-2 text-sm hover:bg-emerald-900"
              href={portalHref("/supplier/inventory")}
            >
              {previewBase ? "Preview inventory" : "Update stock"}
            </Link>
          </>
        }
      />
      <section
        aria-label="Items needing attention"
        className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:grid-cols-3"
      >
        <Attention
          href={`${portalHref("/supplier/orders")}#new`}
          icon={ShoppingBag}
          value={newOrders.length}
          label="New orders"
          helper="Review and respond"
          urgent={newOrders.length > 0}
        />
        <Attention
          href={portalHref("/supplier/inventory")}
          icon={Boxes}
          value={stockAttention}
          label="Products need stock confirmation"
          helper="Update availability"
          urgent={stockAttention > 0}
        />
        <Attention
          href={`${portalHref("/supplier/inventory")}?status=low_stock`}
          icon={PackageCheck}
          value={Number(financials?.low_stock ?? 0)}
          label="Low stock"
          helper={
            Number(financials?.low_stock ?? 0)
              ? "Replenishment required"
              : "Inventory healthy"
          }
          urgent={Number(financials?.low_stock ?? 0) > 0}
        />
      </section>
      <section className="mt-7">
        <h2 className="mb-4 text-lg font-bold text-slate-950">
          Business performance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Sales this month"
            value={money(financials?.sales ?? 0)}
            helper="Completed sales"
          />
          <MetricCard
            label="Inventory value"
            value={money(financials?.cost_value)}
            helper="Current stock cost"
          />
          <MetricCard
            label="Potential sales value"
            value={money(financials?.retail_value ?? 0)}
            helper="Available inventory"
          />
          <MetricCard
            label="Gross margin"
            value={money(financials?.realised_gross_margin)}
            helper="Realised this month"
          />
        </div>
      </section>
      <section className="mt-7">
        <h2 className="mb-4 text-lg font-bold text-slate-950">
          Operations at a glance
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {secondary.map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-950">Recent orders</h2>
            <p className="text-sm text-slate-500">
              Latest customer orders requiring attention.
            </p>
          </div>
          <Link
            href={portalHref("/supplier/orders")}
            className="shrink-0 text-sm font-semibold text-emerald-700"
          >
            View all
          </Link>
        </div>
        <div>
          {orders.slice(0, 5).map((order) => {
            const customer = Array.isArray(order.customer)
              ? order.customer[0]
              : order.customer;
            return (
              <div
                className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
                key={order.id}
              >
                <div>
                  <p className="font-semibold text-slate-950">
                    {order.order_number}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {customer?.full_name ?? "Customer"}
                    {order.created_at
                      ? ` · ${new Date(order.created_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge
                    tone={
                      order.status === "completed"
                        ? "success"
                        : order.status === "cancelled"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {statusLabel(order.status)}
                  </StatusBadge>
                  <span className="min-w-[90px] font-bold text-slate-950 md:text-right">
                    GHS {Number(order.total).toFixed(2)}
                  </span>
                  <Link
                    href={`/supplier/orders/${order.id}`}
                    className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold hover:bg-slate-50"
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })}
          {!orders.length && (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No orders yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}

function Attention({
  href,
  icon: Icon,
  value,
  label,
  helper,
  urgent,
}: {
  href: string;
  icon: typeof ShoppingBag;
  value: number;
  label: string;
  helper: string;
  urgent: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 border-b border-slate-100 p-5 last:border-b-0 hover:bg-slate-50 md:border-b-0 md:border-r md:last:border-r-0"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${urgent ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-950">
          <strong className="mr-1 text-xl">{value}</strong>
          {label}
        </span>
        <span className="text-sm text-slate-500">{helper}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
    </Link>
  );
}
