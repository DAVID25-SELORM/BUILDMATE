import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ListingForm } from "@/components/supplier/products/ListingForm";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSupplierMembership } from "@/lib/supplier/data";
import { setListingActive } from "./actions";

export default async function SupplierProductsPage() {
  const { user } = await requireRole(["supplier"]); const supabase = await createClient();
  const membership = await getSupplierMembership(supabase, user.id);
  if (!membership || membership.organisation.verification_status !== "approved") redirect("/supplier");
  const [{ data: products }, { data: listings }] = await Promise.all([
    supabase.from("products").select("id,name,base_unit").eq("is_active", true).order("name"),
    supabase.from("supplier_listings").select("id,sku,price,stock_quantity,stock_status,lead_time_days,is_active,products(name,base_unit)").eq("supplier_id", membership.organisationId).order("created_at", { ascending: false })
  ]);
  return <DashboardShell title="Supplier portal" nav={[{ label: "Overview", href: "/supplier" }, { label: "Products", href: "/supplier/products" }]}>
    <h1 className="text-3xl font-black">Products and inventory</h1><p className="mt-2 text-slate-600">Publish prices and keep availability current.</p>
    <div className="mt-6"><ListingForm products={products ?? []} /></div>
    <div className="card mt-6 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-4">Product</th><th>SKU</th><th>Price</th><th>Stock</th><th>Lead time</th><th>Status</th><th /></tr></thead><tbody>
      {(listings ?? []).map((listing) => { const product = listing.products as unknown as { name: string; base_unit: string } | null; return <tr className="border-b last:border-0" key={listing.id}><td className="p-4 font-semibold">{product?.name}</td><td>{listing.sku ?? "—"}</td><td>GHS {Number(listing.price).toFixed(2)} / {product?.base_unit}</td><td>{listing.stock_quantity ?? "—"} · {listing.stock_status.replaceAll("_", " ")}</td><td>{listing.lead_time_days} days</td><td>{listing.is_active ? "Active" : "Paused"}</td><td className="p-4"><form action={setListingActive.bind(null, listing.id, !listing.is_active)}><button className="font-semibold text-brand-700">{listing.is_active ? "Pause" : "Activate"}</button></form></td></tr>; })}
      {(listings ?? []).length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">No listings yet.</td></tr>}
    </tbody></table></div>
  </DashboardShell>;
}
