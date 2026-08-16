import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { supplierNavigation } from "@/lib/organisations/navigation";
const reports = [
  "current_stock",
  "valuation",
  "movements",
  "sales_by_product",
  "fast_moving",
  "slow_moving",
  "dead_stock",
  "low_stock",
  "out_of_stock",
  "damaged_lost",
  "adjustments",
  "stock_by_branch",
  "stock_by_warehouse",
];
const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase());
export default async function InventoryReports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const report = reports.includes(q.report ?? "") ? q.report! : "current_stock";
  const now = new Date(),
    to = q.to ?? now.toISOString().slice(0, 10),
    from =
      q.from ??
      new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const { supabase, membership } =
    await requireSupplierPermission("reports.inventory");
  const [{ data, error }, { data: branches }, { data: warehouses }] =
    await Promise.all([
      supabase.rpc("inventory_report", {
        target_organisation: membership.organisationId,
        target_report: report,
        target_from: from,
        target_to: to,
      }),
      supabase
        .from("supplier_branches")
        .select("name")
        .eq("organisation_id", membership.organisationId),
      supabase
        .from("supplier_warehouses")
        .select("id")
        .eq("organisation_id", membership.organisationId)
        .eq("is_active", true),
    ]);
  const singleBranch = branches?.length === 1 ? branches[0] : null;
  const result = (data ?? { rows: [], summary: {} }) as {
    rows: Record<string, unknown>[];
    summary: Record<string, unknown>;
  };
  const columns = Object.keys(result.rows[0] ?? {});
  return (
    <DashboardShell
      title="Supplier portal"
      nav={await supplierNavigation(membership.organisationId)}
    >
      <Link href="/supplier/inventory" className="font-semibold text-brand-700">
        ← Inventory
      </Link>
      <h1 className="mt-3 text-3xl font-black">
        Inventory reports{singleBranch ? ` · ${singleBranch.name}` : ""}
      </h1>
      {singleBranch && (
        <p className="mt-2 text-sm text-slate-600">
          All inventory is currently held at {singleBranch.name}
          {!warehouses?.length ? "; no warehouse filter is needed." : "."}
        </p>
      )}
      <form className="card mt-5 grid gap-3 p-4 md:grid-cols-4">
        <label>
          <span className="label">Report</span>
          <select className="input" name="report" defaultValue={report}>
            {reports.map((x) => (
              <option value={x} key={x}>
                {label(x)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">From</span>
          <input
            className="input"
            type="date"
            name="from"
            defaultValue={from}
          />
        </label>
        <label>
          <span className="label">To</span>
          <input className="input" type="date" name="to" defaultValue={to} />
        </label>
        <div className="flex items-end gap-2">
          <button className="btn-primary">Run report</button>
          <a
            className="btn-secondary"
            href={`/api/supplier/inventory/export?report=${report}&from=${from}&to=${to}`}
          >
            CSV
          </a>
        </div>
      </form>
      {error && <p className="mt-4 text-red-700">{error.message}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {Object.entries(result.summary)
          .filter(([, v]) => typeof v !== "object")
          .map(([k, v]) => (
            <div className="card p-4" key={k}>
              <p className="text-xs font-bold uppercase text-slate-500">
                {label(k)}
              </p>
              <p className="mt-1 text-xl font-black">
                {v == null ? "Restricted" : String(v)}
              </p>
            </div>
          ))}
      </div>
      <section className="card mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b">
              {columns.map((c) => (
                <th className="p-3" key={c}>
                  {label(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr className="border-b last:border-0" key={i}>
                {columns.map((c) => (
                  <td className="p-3" key={c}>
                    {row[c] == null ? "—" : String(row[c])}
                  </td>
                ))}
              </tr>
            ))}
            {!result.rows.length && (
              <tr>
                <td
                  className="p-8 text-center text-slate-500"
                  colSpan={Math.max(columns.length, 1)}
                >
                  No matching report data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </DashboardShell>
  );
}
