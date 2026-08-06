import Link from "next/link";
import { PreviewDashboardButton } from "@/components/admin/PreviewDashboardButton";
import { startCustomerPreview } from "./actions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { createClient } from "@/lib/supabase/server";
type Row = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  account_type: string;
  organisation: string | null;
  region: string | null;
  registered_at: string;
  order_count: number;
  total_spent: number;
  active_projects: number;
  last_activity: string | null;
  account_status: string;
  verification_status: string;
  total_rows: number;
};
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const page = Math.max(1, Number(q.page) || 1);
  const s = await createClient();
  const { data, error } = await s.rpc("admin_list_customers", {
    search_text: q.q || null,
    role_filter: q.type || null,
    status_filter: q.status || null,
    region_filter: q.region || null,
    registered_from: q.from || null,
    registered_to: q.to || null,
    min_spend: q.minSpend ? Number(q.minSpend) : null,
    sort_by: q.sort || "newest",
    page_number: page,
    page_size: 25,
  });
  const rows = (data ?? []) as unknown as Row[];
  const total = Number(rows[0]?.total_rows ?? 0),
    pages = Math.max(1, Math.ceil(total / 25));
  return (
    <DashboardShell title="Platform administration" nav={[...ADMIN_NAV]}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Customers</h1>
          <p className="mt-2 text-slate-600">
            Search, review and manage customer accounts.
          </p>
        </div>
        <a
          className="btn-secondary"
          href={`/api/admin/customers/export?${new URLSearchParams(Object.entries(q).filter((x): x is [string, string] => Boolean(x[1]))).toString()}`}
        >
          Export CSV
        </a>
      </div>
      {q.portal === "customer" && (
        <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          <b>Admin-only customer portal selector.</b> Customers cannot access
          this page or see other customer accounts. Choose an account and
          select Open, then record a support reason to launch its audited,
          read-only dashboard preview.
        </div>
      )}
      <form className="card mt-6 grid gap-3 p-4 md:grid-cols-4">
        <input
          className="input md:col-span-2"
          name="q"
          defaultValue={q.q}
          placeholder="Name, email or phone"
        />
        <select className="input" name="type" defaultValue={q.type}>
          <option value="">All account types</option>
          <option value="customer">Individual customers</option>
          <option value="contractor">Contractors</option>
          <option value="professional">Professionals</option>
        </select>
        <select className="input" name="status" defaultValue={q.status}>
          <option value="">All statuses</option>
          {["active", "pending", "suspended", "restricted", "deactivated"].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>
        <input
          className="input"
          name="region"
          defaultValue={q.region}
          placeholder="Region"
        />
        <input
          className="input"
          name="from"
          defaultValue={q.from}
          type="date"
        />
        <input className="input" name="to" defaultValue={q.to} type="date" />
        <input
          className="input"
          name="minSpend"
          defaultValue={q.minSpend}
          type="number"
          min="0"
          placeholder="Minimum spend"
        />
        <select className="input" name="sort" defaultValue={q.sort}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="highest_spending">Highest spending</option>
          <option value="most_orders">Most orders</option>
        </select>
        <button className="btn-primary">Apply filters</button>
      </form>
      {error && (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
          Unable to load customers: {error.message}
        </div>
      )}
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Customer</th>
              <th>Type</th>
              <th>Organisation</th>
              <th>Region</th>
              <th>Registered</th>
              <th>Orders</th>
              <th>Spent</th>
              <th>Projects</th>
              <th>Last activity</th>
              <th>Status</th>
              <th>Verification</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr className="border-b last:border-0" key={r.id}>
                <td className="p-4">
                  <b>{r.full_name}</b>
                  <p className="text-xs text-slate-500">
                    {r.email} · {r.phone ?? "No phone"}
                  </p>
                </td>
                <td className="capitalize">{r.account_type}</td>
                <td>{r.organisation ?? "—"}</td>
                <td>{r.region ?? "—"}</td>
                <td>{new Date(r.registered_at).toLocaleDateString()}</td>
                <td>{r.order_count}</td>
                <td>GHS {Number(r.total_spent).toFixed(2)}</td>
                <td>{r.active_projects}</td>
                <td>
                  {r.last_activity
                    ? new Date(r.last_activity).toLocaleDateString()
                    : "Never"}
                </td>
                <td>
                  <span className="capitalize">{r.account_status}</span>
                </td>
                <td className="capitalize">{r.verification_status}</td>
                <td>
                  {q.portal === "customer" ? (
                    <PreviewDashboardButton
                      targetLabel={r.full_name}
                      portalLabel="Customer"
                      action={startCustomerPreview.bind(null, r.id)}
                    />
                  ) : (
                    <Link className="font-semibold text-brand-700" href={`/admin/customers/${r.id}`}>Open</Link>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && !error && (
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={12}>
                  No customers match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span>{total} customers</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              className="btn-secondary"
              href={{ query: { ...q, page: String(page - 1) } }}
            >
              Previous
            </Link>
          )}
          <span className="px-3 py-2">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link
              className="btn-secondary"
              href={{ query: { ...q, page: String(page + 1) } }}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
