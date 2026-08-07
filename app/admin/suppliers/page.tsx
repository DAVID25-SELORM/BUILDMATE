import Link from "next/link";
import { PreviewDashboardButton } from "@/components/admin/PreviewDashboardButton";
import { startSupplierPreview } from "./actions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { createClient } from "@/lib/supabase/server";
type Row = {
  id: string;
  business_name: string;
  trading_name: string | null;
  primary_contact: string | null;
  phone: string | null;
  email: string | null;
  business_type: string | null;
  region: string | null;
  categories: string[];
  verification_status: string;
  verification_levels: string[];
  product_count: number;
  order_count: number;
  total_sales: number;
  fulfilment_rate: number;
  average_rating: number;
  settlement_status: string;
  account_status: string;
  registered_at: string;
  performance_rating: string;
  total_rows: number;
};
export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams,
    page = Math.max(1, Number(q.page) || 1),
    s = await createClient();
  const { data, error } = await s.rpc("admin_list_suppliers_v2", {
    search_text: q.q || null,
    status_filter: q.status || null,
    verification_level_filter: q.verification || null,
    region_filter: q.region || null,
    category_filter: q.category || null,
    performance_filter: q.performance || null,
    registered_from: q.from || null,
    registered_to: q.to || null,
    sort_by: q.sort || "newest",
    page_number: page,
    page_size: 25,
  });
  const rows = (data ?? []) as unknown as Row[],
    total = Number(rows[0]?.total_rows ?? 0),
    pages = Math.max(1, Math.ceil(total / 25));
  const supplierIds=rows.map(row=>row.id);
  const[{data:branchRows},{data:warehouseRows}]=supplierIds.length?await Promise.all([s.from("supplier_branches").select("id,name,organisation_id").in("organisation_id",supplierIds),s.from("supplier_warehouses").select("id,name,organisation_id").in("organisation_id",supplierIds)]):[{data:[]},{data:[]}];
  return (
    <DashboardShell title="Platform administration" nav={[...ADMIN_NAV]}>
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Suppliers</h1>
          <p className="mt-2 text-slate-600">
            Verification, trading controls, performance and settlements.
          </p>
        </div>
        <a
          className="btn-secondary"
          href={`/api/admin/suppliers/export?${new URLSearchParams(Object.entries(q).filter((x): x is [string, string] => Boolean(x[1]))).toString()}`}
        >
          Export CSV
        </a>
      </div>
      {q.portal === "supplier" && (
        <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          <b>Admin-only supplier portal selector.</b> Suppliers cannot access
          this page or see other supplier accounts. Choose an organisation and
          select Open, then record a support reason to launch its audited,
          read-only dashboard preview.
        </div>
      )}
      <form className="card mt-6 grid gap-3 p-4 md:grid-cols-4">
        <input
          className="input md:col-span-2"
          name="q"
          defaultValue={q.q}
          placeholder="Business, contact or email"
        />
        <select className="input" name="status" defaultValue={q.status}>
          <option value="">All statuses</option>
          {[
            "draft",
            "submitted",
            "under_review",
            "information_required",
            "approved",
            "rejected",
            "suspended",
          ].map((x) => (
            <option key={x}>{x.replaceAll("_", " ")}</option>
          ))}
        </select>
        <input
          className="input"
          name="region"
          defaultValue={q.region}
          placeholder="Region"
        />
        <input
          className="input"
          name="category"
          defaultValue={q.category}
          placeholder="Product category"
        />
        <select className="input" name="verification" defaultValue={q.verification}>
          <option value="">All verification levels</option>
          {['identity_verified','business_verified','tax_verified','warehouse_verified','authorised_distributor'].map(x=><option key={x}>{x.replaceAll('_',' ')}</option>)}
        </select>
        <input className="input" name="from" defaultValue={q.from} type="date" aria-label="Registered from" />
        <input className="input" name="to" defaultValue={q.to} type="date" aria-label="Registered to" />
        <select
          className="input"
          name="performance"
          defaultValue={q.performance}
        >
          <option value="">All performance</option>
          {["excellent", "good", "needs_attention", "high_risk"].map((x) => (
            <option key={x}>{x.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select className="input" name="sort" defaultValue={q.sort}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="highest_sales">Highest sales</option>
          <option value="most_orders">Most orders</option>
        </select>
        <button className="btn-primary">Apply filters</button>
      </form>
      {error && (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
          Unable to load suppliers: {error.message}
        </div>
      )}
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[1500px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Supplier</th>
              <th>Contact</th>
              <th>Region</th>
              <th>Categories</th>
              <th>Verification</th>
              <th>Products</th>
              <th>Orders</th>
              <th>Sales</th>
              <th>Fulfilment</th>
              <th>Rating</th>
              <th>Settlement</th>
              <th>Account</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr className="border-b last:border-0" key={r.id}>
                <td className="p-4">
                  <b>{r.business_name}</b>
                  <p className="text-xs text-slate-500">
                    {r.trading_name ?? r.business_type ?? "—"}
                  </p>
                </td>
                <td>
                  {r.primary_contact ?? "—"}
                  <p className="text-xs text-slate-500">
                    {r.email ?? r.phone ?? ""}
                  </p>
                </td>
                <td>{r.region ?? "—"}</td>
                <td>{r.categories?.join(", ") || "—"}</td>
                <td className="capitalize">
                  {r.verification_status.replaceAll("_", " ")}
                </td>
                <td>{r.product_count}</td>
                <td>{r.order_count}</td>
                <td>GHS {Number(r.total_sales).toFixed(2)}</td>
                <td>{Number(r.fulfilment_rate).toFixed(1)}%</td>
                <td>
                  {Number(r.average_rating).toFixed(1)} ·{" "}
                  <span className="capitalize">
                    {r.performance_rating.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="capitalize">{r.settlement_status}</td>
                <td className="capitalize">{r.account_status}</td>
                <td>
                  {q.portal === "supplier" ? (
                    <PreviewDashboardButton
                      targetLabel={r.business_name}
                      portalLabel="Supplier"
                      action={startSupplierPreview.bind(null, r.id)}
                      branches={(branchRows??[]).filter(branch=>branch.organisation_id===r.id)}
                      warehouses={(warehouseRows??[]).filter(warehouse=>warehouse.organisation_id===r.id)}
                    />
                  ) : (
                    <Link className="font-semibold text-brand-700" href={`/admin/suppliers/${r.id}`}>Open</Link>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && !error && (
              <tr>
                <td colSpan={13} className="p-8 text-center text-slate-500">
                  {q.portal === "supplier"
                    ? "No supplier organisations are available to preview. Register a supplier account or complete supplier organisation setup."
                    : "No suppliers match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span>{total} suppliers</span>
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
