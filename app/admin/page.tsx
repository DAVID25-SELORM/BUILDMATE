import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { createClient } from "@/lib/supabase/server";
type Point = { bucket: string; value: number };
type Metrics = Record<string, number | Point[]>;
function Chart({
  title,
  data,
  currency = false,
}: {
  title: string;
  data: Point[];
  currency?: boolean;
}) {
  const max = Math.max(1, ...data.map((x) => Number(x.value)));
  return (
    <section className="card p-5">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-4 flex h-40 items-end gap-2">
        {data.map((x) => (
          <div
            className="group flex flex-1 flex-col items-center gap-1"
            key={x.bucket}
          >
            <span className="text-[10px] opacity-0 group-hover:opacity-100">
              {currency ? "GHS " : ""}
              {Number(x.value).toFixed(currency ? 0 : 0)}
            </span>
            <div
              className="w-full rounded-t bg-brand-600"
              style={{
                height: `${Math.max(4, (Number(x.value) / max) * 110)}px`,
              }}
            />
            <span className="text-[9px] text-slate-500">
              {new Date(x.bucket).toLocaleDateString(undefined, {
                month: "short",
              })}
            </span>
          </div>
        ))}
      </div>
      {!data.length && (
        <p className="mt-4 text-sm text-slate-500">No data yet.</p>
      )}
    </section>
  );
}
function Ranking({
  title,
  data,
  currency = false,
}: {
  title: string;
  data: { label: string; value: number }[];
  currency?: boolean;
}) {
  const max = Math.max(1, ...data.map((x) => x.value));
  return (
    <section className="card p-5">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-4 space-y-3">
        {data.map((x) => (
          <div key={x.label}>
            <div className="flex justify-between text-sm">
              <span>{x.label}</span>
              <b>
                {currency ? "GHS " : ""}
                {x.value.toFixed(currency ? 2 : 0)}
              </b>
            </div>
            <div className="mt-1 h-2 rounded bg-slate-100">
              <div
                className="h-2 rounded bg-brand-600"
                style={{ width: `${Math.max(3, (x.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {!data.length && <p className="text-sm text-slate-500">No data yet.</p>}
      </div>
    </section>
  );
}
function RateChart({title,value,detail}:{title:string;value:number;detail:string}){const safe=Math.min(100,Math.max(0,value));return <section className="card p-5"><h2 className="font-bold">{title}</h2><div className="mt-6 h-5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{width:`${safe}%`}}/></div><p className="mt-3 text-2xl font-black">{safe.toFixed(1)}%</p><p className="text-sm text-slate-500">{detail}</p></section>}
export default async function AdminDashboard() {
  const s = await createClient();
  const [
    { data, error },
    { data: products },
    { data: orders },
    { data: suppliers },
    { count: supportOpen },
    { count: supportUrgent },
    { count: supportUnassigned },
    { count: supportAwaiting },
  ] = await Promise.all([
    s.rpc("admin_overview_metrics"),
    s.from("products").select("categories(name)"),
    s.from("orders").select("supplier_id,total,status"),
    s
      .from("organisations")
      .select("id,name")
      .eq("organisation_type", "supplier"),
    s.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    s.from("support_tickets").select("id", { count: "exact", head: true }).eq("priority", "urgent").in("status", ["open", "in_progress"]),
    s.from("support_tickets").select("id", { count: "exact", head: true }).is("assigned_to", null).in("status", ["open", "in_progress"]),
    s.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const categories = new Map<string, number>();
  products?.forEach((p) => {
    const label =
      (p.categories as unknown as { name: string } | null)?.name ??
      "Uncategorised";
    categories.set(label, (categories.get(label) ?? 0) + 1);
  });
  const sales = new Map<string, number>();
  orders
    ?.filter((o) => o.status !== "cancelled")
    .forEach((o) =>
      sales.set(
        o.supplier_id,
        (sales.get(o.supplier_id) ?? 0) + Number(o.total),
      ),
    );
  const supplierNames = new Map(suppliers?.map((x) => [x.id, x.name]) ?? []);
  const m = (data ?? {}) as unknown as Metrics;
  const card = (key: string) => Number(m[key] ?? 0);
  return (
    <DashboardShell title="Platform administration" nav={[...ADMIN_NAV]}>
      <h1 className="text-3xl font-black">Platform overview</h1>
      <p className="mt-2 text-slate-600">
        Live customer, supplier, commerce and risk indicators.
      </p>
      {error && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">
          Unable to load overview: {error.message}
        </div>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total customers"
          value={String(card("total_customers"))}
          detail="Registered customer accounts"
        />
        <MetricCard label="Active customers" value={String(card("active_customers"))} detail="Currently permitted to transact" />
        <MetricCard label="New customers this month" value={String(card("new_customers_month"))} detail="Month-to-date registrations" />
        <MetricCard
          label="Total suppliers"
          value={String(card("total_suppliers"))}
          detail="Registered supplier organisations"
        />
        <MetricCard label="Approved suppliers" value={String(card("approved_suppliers"))} detail="Verified for marketplace trading" />
        <MetricCard label="Pending supplier applications" value={String(card("pending_suppliers"))} detail="Submitted or under review" />
        <MetricCard
          label="Suspended suppliers"
          value={String(card("suspended_suppliers"))}
          detail="Verification or account suspension"
        />
        <MetricCard
          label="Total orders"
          value={String(card("total_orders"))}
          detail="All marketplace orders"
        />
        <MetricCard label="Orders in progress" value={String(card("orders_in_progress"))} detail="Active fulfilment lifecycle" />
        <MetricCard label="Completed orders" value={String(card("completed_orders"))} detail="Successfully completed" />
        <MetricCard
          label="Gross merchandise value"
          value={`GHS ${card("gmv").toFixed(2)}`}
          detail="Non-cancelled orders"
        />
        <MetricCard
          label="Platform revenue"
          value={`GHS ${card("platform_revenue").toFixed(2)}`}
          detail="Recorded service fees"
        />
        <MetricCard
          label="Pending settlements"
          value={`GHS ${card("pending_settlements").toFixed(2)}`}
          detail="Pending and available ledger"
        />
        <MetricCard
          label="Open disputes"
          value={String(card("open_disputes"))}
          detail="Require review"
        />
        <MetricCard
          label="Repeat purchase rate"
          value={`${card("repeat_purchase_rate").toFixed(1)}%`}
          detail="Customers with multiple orders"
        />
        <MetricCard
          label="Fulfilment rate"
          value={`${card("fulfilment_rate").toFixed(1)}%`}
          detail="Completed against all orders"
        />
      </div>
      <section className="card mt-6 p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Support attention</h2><p className="text-sm text-slate-600">Live requests requiring operational follow-up.</p></div><Link className="text-sm font-bold text-brand-700" href="/admin/support">Open Support →</Link></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Open",supportOpen??0,"open"],["Urgent",supportUrgent??0,"urgent"],["Unassigned",supportUnassigned??0,"unassigned"],["Awaiting response",supportAwaiting??0,"open"]].map(([label,value,filter])=><Link className="rounded-xl bg-slate-50 p-4" href={`/admin/support?filter=${filter}`} key={label}><p className="text-xs font-bold uppercase text-slate-500">{label}</p><b className="mt-1 block text-2xl">{value}</b></Link>)}</div>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Chart
          title="Customer registrations"
          data={(m.customer_registrations ?? []) as Point[]}
        />
        <Chart
          title="Supplier registrations"
          data={(m.supplier_registrations ?? []) as Point[]}
        />
        <Chart
          title="Orders over time"
          data={(m.orders_over_time ?? []) as Point[]}
        />
        <Chart
          title="Sales value over time"
          data={(m.sales_over_time ?? []) as Point[]}
          currency
        />
        <Ranking
          title="Top product categories"
          data={[...categories]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([label, value]) => ({ label, value }))}
        />
        <Ranking
          title="Top suppliers"
          currency
          data={[...sales]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([id, value]) => ({
              label: supplierNames.get(id) ?? "Unknown supplier",
              value,
          }))}
        />
        <RateChart title="Customer repeat-purchase rate" value={card("repeat_purchase_rate")} detail="Customers with more than one order"/>
        <RateChart title="Order fulfilment rate" value={card("fulfilment_rate")} detail="Completed orders against all orders"/>
      </div>
    </DashboardShell>
  );
}
