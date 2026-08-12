import { redirect } from "next/navigation";
import { ProductMediaManager } from "@/components/commerce/ProductMediaManager";
import { CataloguePicker } from "@/components/supplier/products/CataloguePicker";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SupplierProductsView } from "@/components/dashboard/PortalSectionViews";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { supplierNavigation } from "@/lib/organisations/navigation";

type ListingRow = { id: string; products: { name: string; base_unit: string } | { name: string; base_unit: string }[] | null; product_media?: { id: string; storage_path: string; alt_text: string; is_cover: boolean; sort_order: number }[] };

export default async function SupplierProductsPage() {
  const { supabase, membership } = await requireSupplierPermission("products.view");
  if (membership.organisation.verification_status !== "approved") redirect("/supplier");
  const [{ data: products }, { data: listings }] = await Promise.all([
    supabase.from("products").select("id,name,base_unit,categories(name),brands(name)").eq("is_active", true).order("name"),
    supabase.from("supplier_listings").select("id,product_id,sku,price,wholesale_price,wholesale_minimum,stock_quantity,stock_status,lead_time_days,minimum_order_quantity,delivery_available,pickup_available,supplier_notes,listing_status,is_active,products(name,base_unit),product_media(id,storage_path,alt_text,is_cover,sort_order)").eq("supplier_id", membership.organisationId).order("created_at", { ascending: false }),
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
  return <DashboardShell title="Supplier portal" nav={await supplierNavigation(membership.organisationId)}><CataloguePicker products={catalogue} /><div className="mt-6"><SupplierProductsView listings={listings ?? []} products={catalogue} /></div><ProductMediaManager listings={mediaListings} /></DashboardShell>;
}
