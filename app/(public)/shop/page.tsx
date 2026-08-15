import { ProductCard } from "@/components/commerce/ProductCard";
import { matchesDeliveryCoverage } from "@/lib/delivery/coverage";
import { createClient } from "@/lib/supabase/server";

type Coverage = { regions_served: string[]; cities_served: string[]; minimum_order_value: number | null };
type Media = { storage_path: string; alt_text: string; is_cover: boolean; sort_order: number };
type Listing = { id: string; product_id: string; price: number | string | null; product_media: Media[] | null; products: { id: string; name: string; base_unit: string; images: string[]; is_active: boolean; categories: { name: string; slug: string } | null }; organisations: { name: string; verification_status: string; supplier_delivery_coverage: Coverage | Coverage[] | null } };

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; location?: string; sort?: string }> }) {
  const { q = "", category = "", location = "", sort = "best" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("supplier_listings").select("id,product_id,price,lead_time_days,stock_status,product_media(storage_path,alt_text,is_cover,sort_order),products!inner(id,name,base_unit,images,is_active,categories(name,slug)),organisations!inner(name,verification_status,supplier_delivery_coverage(regions_served,cities_served,minimum_order_value))").eq("listing_status", "published").eq("is_active", true).eq("products.is_active", true).eq("organisations.verification_status", "approved").neq("stock_status", "out_of_stock").order("price");
  if (q) query = query.ilike("products.name", `%${q}%`);
  if (category) query = query.eq("products.categories.slug", category);
  const [{ data: rawListings }, { data: categories }] = await Promise.all([query, supabase.from("categories").select("name,slug").eq("is_active", true).order("sort_order")]);
  const grouped = new Map<string, { productId: string; name: string; category: string; unit: string; lowestPrice: number; supplierCount: number; imageUrl?: string; imageAlt?: string }>();
  for (const listing of (rawListings ?? []) as unknown as Listing[]) {
    const coverageRaw = listing.organisations.supplier_delivery_coverage;
    const coverage = Array.isArray(coverageRaw) ? coverageRaw[0] ?? null : coverageRaw;
    // A catalogue card has no order quantity yet, so minimum order value is
    // enforced at checkout rather than against a single unit price here.
    if (listing.price == null || !matchesDeliveryCoverage(location, Number.POSITIVE_INFINITY, coverage)) continue;
    const existing = grouped.get(listing.product_id);
    const media = [...(listing.product_media ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0];
    const mediaUrl = media ? supabase.storage.from("product-media").getPublicUrl(media.storage_path).data.publicUrl : listing.products.images?.[0];
    if (existing) { existing.supplierCount += 1; existing.lowestPrice = Math.min(existing.lowestPrice, Number(listing.price)); if (!existing.imageUrl && mediaUrl) { existing.imageUrl = mediaUrl; existing.imageAlt = media?.alt_text; } }
    else grouped.set(listing.product_id, { productId: listing.product_id, name: listing.products.name, category: listing.products.categories?.name ?? "Materials", unit: listing.products.base_unit, lowestPrice: Number(listing.price), supplierCount: 1, imageUrl: mediaUrl, imageAlt: media?.alt_text });
  }
  const cards = [...grouped.values()].sort((a, b) => sort === "price" ? a.lowestPrice - b.lowestPrice : b.supplierCount - a.supplierCount || a.lowestPrice - b.lowestPrice);
  return <section className="container-shell py-12"><p className="font-semibold text-brand-700">MASTER CATALOGUE</p><h1 className="mt-2 text-4xl font-black">Shop building materials</h1><p className="mt-3 text-slate-600">One standard product, with prices and availability from verified suppliers.</p><form className="mt-8 grid gap-4 rounded-2xl border bg-white p-4 md:grid-cols-5"><input className="input md:col-span-2" name="q" defaultValue={q} placeholder="Search materials or brands" /><select className="input" name="category" defaultValue={category}><option value="">All categories</option>{(categories ?? []).map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select><input className="input" name="location" defaultValue={location} placeholder="Delivery city or region" /><button className="btn-primary">Search</button><label className="text-sm md:col-start-5"><span className="sr-only">Sort products</span><select className="input py-2" name="sort" defaultValue={sort}><option value="best">Best availability</option><option value="price">Lowest starting price</option></select></label></form><div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">{cards.map(product => <ProductCard key={product.productId} product={{ name: product.name, category: product.category, price: product.lowestPrice, unit: product.unit, supplier: `${product.supplierCount} verified supplier${product.supplierCount === 1 ? "" : "s"}`, productId: product.productId, supplierCount: product.supplierCount, location: location || undefined, imageUrl: product.imageUrl, imageAlt: product.imageAlt }} />)}</div>{cards.length === 0 && <div className="card mt-8 p-10 text-center text-slate-500">No published supplier offers match your search and delivery location.</div>}</section>;
}
