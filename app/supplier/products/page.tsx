import { redirect } from "next/navigation";
import { ProductMediaManager } from "@/components/commerce/ProductMediaManager";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SupplierProductsView } from "@/components/dashboard/PortalSectionViews";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { supplierNavigation } from "@/lib/organisations/navigation";

type ListingRow = { id: string; products: { name: string; base_unit: string } | { name: string; base_unit: string }[] | null; product_media?: { id: string; storage_path: string; alt_text: string; is_cover: boolean; sort_order: number }[] };

export default async function SupplierProductsPage() {
  const { supabase, membership } = await requireSupplierPermission("products.view");
  if (membership.organisation.verification_status !== "approved") redirect("/supplier");
  const [{ data: products }, { data: listings }] = await Promise.all([
    supabase.from("products").select("id,name,base_unit").eq("is_active", true).order("name"),
    supabase.from("supplier_listings").select("id,sku,price,stock_quantity,stock_status,lead_time_days,is_active,products(name,base_unit),product_media(id,storage_path,alt_text,is_cover,sort_order)").eq("supplier_id", membership.organisationId).order("created_at", { ascending: false }),
  ]);
  const mediaListings = ((listings ?? []) as unknown as ListingRow[]).map(listing => {
    const product = Array.isArray(listing.products) ? listing.products[0] : listing.products;
    return { id: listing.id, name: product?.name ?? "Product listing", media: (listing.product_media ?? []).sort((a, b) => a.sort_order - b.sort_order).map(item => ({ id: item.id, url: supabase.storage.from("product-media").getPublicUrl(item.storage_path).data.publicUrl, altText: item.alt_text, isCover: item.is_cover })) };
  });
  return <DashboardShell title="Supplier portal" nav={await supplierNavigation(membership.organisationId)}><SupplierProductsView listings={listings ?? []} products={products ?? []} /><ProductMediaManager listings={mediaListings} /></DashboardShell>;
}
