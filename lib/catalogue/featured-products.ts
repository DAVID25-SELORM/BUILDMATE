import "server-only";
import type { Product } from "@/components/commerce/ProductCard";
import { createClient } from "@/lib/supabase/server";

type FeaturedListing = {
  product_id: string;
  supplier_id: string;
  price: number | string | null;
  products: {
    name: string;
    base_unit: string;
    images: string[];
    categories: { name: string } | null;
  };
  organisations: { name: string };
};

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("supplier_listings")
    .select(
      "product_id,supplier_id,price,products!inner(name,base_unit,images,is_active,categories(name)),organisations!supplier_listings_supplier_id_fkey!inner(name,verification_status,account_status)",
    )
    .eq("listing_status", "published")
    .eq("is_active", true)
    .eq("products.is_active", true)
    .eq("organisations.verification_status", "approved")
    .eq("organisations.account_status", "active")
    .neq("stock_status", "out_of_stock")
    .order("price")
    .limit(100);
  const grouped = new Map<
    string,
    { product: FeaturedListing; offerCount: number; supplierIds: Set<string> }
  >();
  for (const listing of (data ?? []) as unknown as FeaturedListing[]) {
    if (listing.price == null) continue;
    const existing = grouped.get(listing.product_id);
    if (existing) {
      existing.offerCount += 1;
      existing.supplierIds.add(listing.supplier_id);
      if (Number(listing.price) < Number(existing.product.price))
        existing.product = listing;
    } else
      grouped.set(listing.product_id, {
        product: listing,
        offerCount: 1,
        supplierIds: new Set([listing.supplier_id]),
      });
  }
  return [...grouped.values()]
    .sort(
      (a, b) =>
        b.offerCount - a.offerCount ||
        Number(a.product.price) - Number(b.product.price),
    )
    .slice(0, limit)
    .map(({ product, offerCount, supplierIds }) => ({
      productId: product.product_id,
      name: product.products.name,
      category: product.products.categories?.name ?? "Materials",
      price: Number(product.price),
      unit: product.products.base_unit,
      supplier: `${supplierIds.size} verified supplier${supplierIds.size === 1 ? "" : "s"}`,
      supplierCount: supplierIds.size,
      offerCount,
      imageUrl: product.products.images?.[0],
    }));
}
