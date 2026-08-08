import { ProductCard } from "@/components/commerce/ProductCard";
import { matchesDeliveryCoverage } from "@/lib/delivery/coverage";
import { createClient } from "@/lib/supabase/server";

type Coverage = { regions_served: string[]; cities_served: string[]; minimum_order_value: number | null };
type Media = { storage_path: string; alt_text: string; is_cover: boolean; sort_order: number };

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; location?: string }> }) {
  const { q = "", category = "", location = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("supplier_listings").select("id,price,product_media(storage_path,alt_text,is_cover,sort_order),products!inner(name,base_unit,is_active,categories(name,slug)),organisations!inner(name,verification_status,supplier_delivery_coverage(regions_served,cities_served,minimum_order_value))").eq("is_active", true).eq("products.is_active", true).eq("organisations.verification_status", "approved").neq("stock_status", "out_of_stock").order("price");
  if (q) query = query.ilike("products.name", `%${q}%`);
  if (category) query = query.eq("products.categories.slug", category);
  const [{ data: listings }, { data: categories }] = await Promise.all([query, supabase.from("categories").select("name,slug").eq("is_active", true).order("sort_order")]);
  const cards = (listings ?? []).flatMap(listing => {
    const product = listing.products as unknown as { name: string; base_unit: string; categories: { name: string } | null };
    const supplier = listing.organisations as unknown as { name: string; supplier_delivery_coverage: Coverage | Coverage[] | null };
    const rawCoverage = supplier.supplier_delivery_coverage;
    const coverage = Array.isArray(rawCoverage) ? rawCoverage[0] ?? null : rawCoverage;
    if (!matchesDeliveryCoverage(location, Number(listing.price), coverage)) return [];
    const media = ([...(listing.product_media ?? [])] as Media[]).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0];
    return [{ listingId: listing.id, name: product.name, category: product.categories?.name ?? "Materials", price: Number(listing.price), unit: product.base_unit, supplier: supplier.name, location: location || undefined, imageUrl: media ? supabase.storage.from("product-media").getPublicUrl(media.storage_path).data.publicUrl : undefined, imageAlt: media?.alt_text }];
  });
  return <section className="container-shell py-12"><p className="font-semibold text-brand-700">MARKETPLACE</p><h1 className="mt-2 text-4xl font-black">Shop building materials</h1><p className="mt-3 text-slate-600">Compare verified suppliers, prices and delivery coverage.</p><form className="mt-8 grid gap-4 rounded-2xl border bg-white p-4 md:grid-cols-4"><input className="input" name="q" defaultValue={q} placeholder="Search materials"/><select className="input" name="category" defaultValue={category}><option value="">All categories</option>{(categories ?? []).map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select><input className="input" name="location" defaultValue={location} placeholder="Delivery city or region"/><button className="btn-primary">Search</button></form><div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">{cards.map(product => <ProductCard key={product.listingId} product={product}/>)}</div>{cards.length === 0 && <div className="card mt-8 p-10 text-center text-slate-500">No active supplier listings match your search and delivery location.</div>}</section>;
}
