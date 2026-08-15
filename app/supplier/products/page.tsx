import { redirect } from "next/navigation";
import { ProductMediaManager } from "@/components/commerce/ProductMediaManager";
import { CataloguePicker } from "@/components/supplier/products/CataloguePicker";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ListingForm } from "@/components/supplier/products/ListingForm";
import { SupplierInventoryEditor, type InventoryListing } from "@/components/supplier/products/SupplierInventoryEditor";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { supplierNavigation } from "@/lib/organisations/navigation";

type ListingRow = { id: string; products: { name: string; base_unit: string } | { name: string; base_unit: string }[] | null; product_media?: { id: string; storage_path: string; alt_text: string; is_cover: boolean; sort_order: number }[] };

export default async function SupplierProductsPage() {
  const { supabase, membership } = await requireSupplierPermission("products.view");
  if (membership.organisation.verification_status !== "approved") redirect("/supplier");
  const [{ data: products }, { data: listings }, { data: branches }, { data: warehouses }, { data: organisation }, { data: clarifications }] = await Promise.all([
    supabase.from("products").select("id,name,base_unit,categories(name),brands(name)").eq("is_active", true).order("name"),
    supabase.from("supplier_listings").select("id,product_id,product_variant_id,sku,price,currency,price_effective_date,updated_at,wholesale_price,wholesale_minimum,stock_quantity,stock_status,lead_time_days,minimum_order_quantity,delivery_available,pickup_available,supplier_notes,listing_status,is_active,branch_id,warehouse_id,products(name,base_unit),product_variants(name,specifications),supplier_branches(name),product_media(id,storage_path,alt_text,is_cover,sort_order)").eq("supplier_id", membership.organisationId).order("created_at", { ascending: false }),
    supabase.from("supplier_branches").select("id,name").eq("organisation_id",membership.organisationId).order("is_main_branch",{ascending:false}),
    supabase.from("supplier_warehouses").select("id,name,branch_id").eq("organisation_id",membership.organisationId).eq("is_active",true).order("name"),
    supabase.from("organisations").select("account_status,verification_status,product_publishing_enabled").eq("id",membership.organisationId).maybeSingle(),
    supabase.from("supplier_price_clarifications").select("id,raw_description,raw_price_text,notes").eq("supplier_id",membership.organisationId).eq("status","requires_confirmation").order("created_at"),
  ]);
  const mediaListings = ((listings ?? []) as unknown as ListingRow[]).map(listing => {
    const product = Array.isArray(listing.products) ? listing.products[0] : listing.products;
    return { id: listing.id, name: product?.name ?? "Product listing", media: (listing.product_media ?? []).sort((a, b) => a.sort_order - b.sort_order).map(item => ({ id: item.id, url: supabase.storage.from("product-media").getPublicUrl(item.storage_path).data.publicUrl, altText: item.alt_text, isCover: item.is_cover })) };
  });
  const catalogue = (products ?? []).map(product => ({
    id: product.id,
    name: product.name,
    base_unit: product.base_unit,
    category: (product.categories as unknown as { name: string } | null)?.name ?? "Uncategorised",
    brand: (product.brands as unknown as { name: string } | null)?.name ?? null,
  }));
  const inventoryListings = (listings ?? []) as unknown as InventoryListing[];
  const supplierCanPublish = organisation?.account_status === "active" && organisation?.verification_status === "approved" && organisation?.product_publishing_enabled === true;
  return <DashboardShell title="Supplier portal" nav={await supplierNavigation(membership.organisationId)}>
    <div><h1 className="text-3xl font-black">Products and inventory</h1><p className="mt-2 text-slate-600">Complete prices and stock, assign fulfilment, then publish verified offers.</p></div>
    {!supplierCanPublish && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Publishing is unavailable until the supplier account is active, approved and enabled for product publishing. Draft editing remains available.</div>}
    <div className="mt-6"><SupplierInventoryEditor listings={inventoryListings} branches={branches ?? []} warehouses={warehouses ?? []} supplierCanPublish={supplierCanPublish} /></div>
    {!!clarifications?.length && <section className="card mt-6 p-5"><h2 className="text-xl font-bold">Price-sheet clarification queue</h2><p className="mt-1 text-sm text-slate-600">These invoice lines were not added to the catalogue because their name, size, unit, or price needs confirmation.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b"><th className="py-3 pr-4">Invoice description</th><th className="py-3 pr-4">Uncertain price</th><th className="py-3 pr-4">Reason</th><th className="py-3">Next action</th></tr></thead><tbody>{clarifications.map((item) => <tr className="border-b last:border-0" key={item.id}><td className="py-3 pr-4 font-semibold">{item.raw_description}</td><td className="py-3 pr-4">{item.raw_price_text ? `GHS ${item.raw_price_text}` : "Not provided"}</td><td className="py-3 pr-4 text-slate-600">{item.notes}</td><td className="py-3 text-slate-600">Confirm name, size, unit and price; then map to an existing product or request a new product.</td></tr>)}</tbody></table></div></section>}
    <details className="card mt-6 p-5"><summary className="cursor-pointer text-lg font-bold text-brand-800">Advanced listing details</summary><p className="mt-2 text-sm text-slate-600">Edit SKU, wholesale terms, minimum order, lead time, notes and individual fulfilment settings.</p><div className="mt-5 space-y-4">{inventoryListings.map((listing) => <ListingForm key={listing.id} products={catalogue} branches={branches ?? []} warehouses={warehouses ?? []} initial={{ id:listing.id, productId:listing.product_id, sku:listing.sku, price:listing.price, wholesalePrice:listing.wholesale_price, wholesaleMinimum:listing.wholesale_minimum, stockQuantity:listing.stock_quantity, stockStatus:listing.stock_status, leadTimeDays:listing.lead_time_days, minimumOrderQuantity:listing.minimum_order_quantity, deliveryAvailable:listing.delivery_available, pickupAvailable:listing.pickup_available, supplierNotes:listing.supplier_notes, listingStatus:listing.listing_status, branchId:listing.branch_id, warehouseId:listing.warehouse_id }} />)}</div></details>
    <details className="mt-6"><summary className="cursor-pointer font-bold text-brand-800">Add more catalogue products</summary><div className="mt-3"><CataloguePicker products={catalogue} /></div></details>
    <ProductMediaManager listings={mediaListings} />
  </DashboardShell>;
}
