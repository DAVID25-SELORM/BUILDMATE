import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { supplierNavigation } from "@/lib/organisations/navigation";

type Movement = {
  id: string;
  movement_type: string;
  quantity: number;
  unit_cost: number | null;
  previous_on_hand: number;
  resulting_on_hand: number;
  previous_reserved: number;
  resulting_reserved: number;
  reference_type: string | null;
  reference_id: string | null;
  reason: string;
  created_by: string | null;
  created_at: string;
};
type Position = {
  on_hand: number | null;
  reserved: number | null;
  available: number | null;
  sold: number | null;
  damaged: number | null;
  lost: number | null;
  returned: number | null;
  average_cost: number | null;
  selling_price: number | null;
  cost_value: number | null;
  selling_value: number | null;
  potential_margin: number | null;
  reorder_point: number | null;
  last_movement: string | null;
};
type Price = {
  id: number;
  previous_price: number | null;
  new_price: number;
  currency: string;
  effective_date: string;
  source: string;
  created_at: string;
  profiles:
    { full_name: string | null } | { full_name: string | null }[] | null;
};
const money = (value: number | null) =>
  value == null ? "Not available" : `GHS ${Number(value).toFixed(2)}`;
const metric = (value: number | null) =>
  value == null ? "Not tracked" : String(value);

export default async function InventoryDetail({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) notFound();
  const { supabase, membership } =
    await requireSupplierPermission("inventory.view");
  const [
    { data: listing },
    { data: history },
    { data: position },
    { data: prices },
  ] = await Promise.all([
    supabase
      .from("supplier_listings")
      .select(
        "id,price,inventory_mode,listing_status,is_active,stock_status,supplier_branches(name),supplier_warehouses(name),products(name),product_variants(name)",
      )
      .eq("id", listingId)
      .eq("supplier_id", membership.organisationId)
      .maybeSingle(),
    supabase.rpc("inventory_movement_history", { target_listing: listingId }),
    supabase.rpc("inventory_listing_position", { target_listing: listingId }),
    supabase
      .from("supplier_price_history")
      .select(
        "id,previous_price,new_price,currency,effective_date,source,created_at,profiles!supplier_price_history_changed_by_fkey(full_name)",
      )
      .eq("supplier_listing_id", listingId)
      .order("created_at", { ascending: false }),
  ]);
  if (!listing) notFound();
  const product = listing.products as unknown as { name: string } | null,
    variant = listing.product_variants as unknown as { name: string } | null,
    branch = listing.supplier_branches as unknown as { name: string } | null,
    warehouse = listing.supplier_warehouses as unknown as {
      name: string;
    } | null;
  const rows = (history ?? []) as Movement[],
    current = (position ?? {}) as Position,
    priceRows = (prices ?? []) as Price[];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const soldThisMonth = rows
    .filter(
      (row) =>
        row.movement_type === "sale_completed" &&
        new Date(row.created_at) >= monthStart,
    )
    .reduce((total, row) => total + Number(row.quantity), 0);
  const quantityCards = [
    ["On hand", metric(current.on_hand)],
    ["Reserved", metric(current.reserved)],
    ["Available", metric(current.available)],
    ["Sold this month", String(soldThisMonth)],
    ["Damaged / lost", `${metric(current.damaged)} / ${metric(current.lost)}`],
    ["Returned", metric(current.returned)],
  ];
  const financialCards = [
    ["Average unit cost", money(current.average_cost)],
    ["Selling price", money(current.selling_price)],
    ["Stock cost value", money(current.cost_value)],
    ["Potential sales value", money(current.selling_value)],
    ["Potential gross margin", money(current.potential_margin)],
  ];
  return (
    <DashboardShell
      title="Supplier portal"
      nav={await supplierNavigation(membership.organisationId)}
    >
      <Link className="font-semibold text-brand-700" href="/supplier/inventory">
        ← Inventory
      </Link>
      <h1 className="mt-3 text-3xl font-black">
        {product?.name}
        {variant ? ` — ${variant.name}` : ""}
      </h1>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-full bg-slate-100 px-3 py-1">
          {branch?.name ?? "No branch"}
          {warehouse ? ` / ${warehouse.name}` : ""}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">
          {listing.inventory_mode.replaceAll("_", " ")}
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 capitalize">
          Listing: {listing.listing_status.replaceAll("_", " ")}
        </span>
        <span
          className={`rounded-full px-3 py-1 ${listing.is_active ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
        >
          Marketplace: {listing.is_active ? "Visible" : "Hidden"}
        </span>
      </div>
      <p className="mt-3 text-slate-600">
        Append-only stock history. Corrections are recorded as compensating
        movements.
      </p>
      <h2 className="mt-6 text-lg font-black">Current position</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quantityCards.map(([label, value]) => (
          <div className="card p-4" key={label}>
            <p className="text-xs font-bold uppercase text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-lg font-black">{value}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-6 text-lg font-black">Financial position</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {financialCards.map(([label, value]) => (
          <div className="card p-4" key={label}>
            <p className="text-xs font-bold uppercase text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-lg font-black">{value}</p>
          </div>
        ))}
      </div>
      <section className="card mt-6 overflow-x-auto">
        <div className="p-5">
          <h2 className="text-xl font-bold">Price history</h2>
          <p className="text-sm text-slate-600">
            Append-only history of supplier price changes.
          </p>
        </div>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Effective date</th>
              <th>Previous</th>
              <th>New</th>
              <th>Source</th>
              <th>Changed by</th>
              <th>Recorded</th>
            </tr>
          </thead>
          <tbody>
            {priceRows.map((price) => {
              const actor = Array.isArray(price.profiles)
                ? price.profiles[0]
                : price.profiles;
              return (
                <tr className="border-b last:border-0" key={price.id}>
                  <td className="p-4">{price.effective_date}</td>
                  <td>
                    {price.previous_price == null
                      ? "Initial price"
                      : `${price.currency} ${Number(price.previous_price).toFixed(2)}`}
                  </td>
                  <td className="font-bold">
                    {price.currency} {Number(price.new_price).toFixed(2)}
                  </td>
                  <td>{price.source}</td>
                  <td>{actor?.full_name ?? "System"}</td>
                  <td>{new Date(price.created_at).toLocaleString("en-GH")}</td>
                </tr>
              );
            })}
            {!priceRows.length && (
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={6}>
                  No price changes recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <section id="movements" className="card mt-6 p-5">
        <h2 className="text-xl font-black">Movement timeline</h2>
        <div className="mt-5 space-y-4">
          {rows.map((movement) => {
            const positive =
              [
                "opening_stock",
                "purchase_receipt",
                "customer_return",
                "transfer_in",
                "stock_adjustment_positive",
              ].includes(movement.movement_type) ||
              (movement.movement_type === "stock_count_correction" &&
                movement.quantity > 0);
            return (
              <article
                className="border-l-2 border-brand-200 pl-4"
                key={movement.id}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-black">
                    <span
                      className={positive ? "text-emerald-700" : "text-red-700"}
                    >
                      {positive ? "+" : "−"}
                      {Math.abs(Number(movement.quantity))}
                    </span>{" "}
                    <span className="capitalize">
                      {movement.movement_type.replaceAll("_", " ")}
                    </span>
                  </p>
                  <time className="text-xs text-slate-500">
                    {new Date(movement.created_at).toLocaleString("en-GH")}
                  </time>
                </div>
                <p className="mt-1 text-sm text-slate-700">{movement.reason}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {movement.reference_type
                    ? `${movement.reference_type.replaceAll("_", " ")}${movement.reference_id ? ` · ${movement.reference_id}` : ""}`
                    : "No external reference"}{" "}
                  · {movement.created_by ?? "System"} · On hand{" "}
                  {movement.previous_on_hand} → {movement.resulting_on_hand}
                </p>
              </article>
            );
          })}
          {!rows.length && (
            <p className="py-8 text-center text-sm text-slate-500">
              No inventory movements yet.
            </p>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
