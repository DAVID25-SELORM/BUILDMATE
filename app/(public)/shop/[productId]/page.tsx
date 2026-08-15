import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Clock3, MapPin, PackageCheck, Truck } from "lucide-react";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/commerce/AddToCartButton";
import { createClient } from "@/lib/supabase/server";

type Offer = {
  id: string; price: number | string; wholesale_price: number | string | null;
  wholesale_minimum: number | string | null; stock_quantity: number | string | null;
  stock_status: string; inventory_mode: string; show_exact_stock_to_customers: boolean; lead_time_days: number; minimum_order_quantity: number | string | null;
  delivery_available: boolean; pickup_available: boolean; supplier_notes: string | null;
  organisations: { name: string; verification_status: string };
  supplier_branches: { name: string; city: string; region: string } | null;
  product_variants: { name: string } | null;
  product_media: { storage_path: string; alt_text: string; is_cover: boolean; sort_order: number }[] | null;
};

export default async function ProductOffersPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();
  const supabase = await createClient();
  const [{ data: product }, { data: rawOffers }] = await Promise.all([
    supabase.from("products").select("id,name,description,base_unit,specifications,images,categories(name),brands(name)").eq("id", productId).eq("is_active", true).maybeSingle(),
    supabase.from("supplier_listings").select("id,price,wholesale_price,wholesale_minimum,stock_quantity,stock_status,inventory_mode,show_exact_stock_to_customers,lead_time_days,minimum_order_quantity,delivery_available,pickup_available,supplier_notes,organisations!inner(name,verification_status),supplier_branches(name,city,region),product_variants(name),product_media(storage_path,alt_text,is_cover,sort_order)").eq("product_id", productId).eq("listing_status", "published").eq("is_active", true).eq("organisations.verification_status", "approved").neq("stock_status", "out_of_stock").order("price"),
  ]);
  if (!product) notFound();
  const offers = (rawOffers ?? []) as unknown as Offer[];
  const firstMedia = offers.flatMap((offer) => offer.product_media ?? []).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order)[0];
  const imageUrl = firstMedia ? supabase.storage.from("product-media").getPublicUrl(firstMedia.storage_path).data.publicUrl : product.images?.[0];
  const category = (product.categories as unknown as { name: string } | null)?.name ?? "Materials";
  const brand = (product.brands as unknown as { name: string } | null)?.name;

  return <section className="container-shell py-12">
    <Link href="/shop" className="font-semibold text-brand-700">← Back to marketplace</Link>
    <div className="mt-6 grid gap-8 lg:grid-cols-[380px_1fr]">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-slate-100">{imageUrl ? <Image src={imageUrl} alt={firstMedia?.alt_text ?? product.name} fill sizes="(max-width:1024px) 100vw,380px" className="object-cover" /> : <div className="flex h-full items-center justify-center p-8 text-center text-slate-500">Product image coming soon</div>}</div>
      <div><p className="font-semibold text-brand-700">{category}{brand ? ` · ${brand}` : ""}</p><h1 className="mt-2 text-4xl font-black">{product.name}</h1><p className="mt-4 max-w-3xl leading-7 text-slate-600">{product.description ?? "Compare current offers from approved BuildMate suppliers."}</p><div className="mt-6 flex flex-wrap gap-3"><span className="rounded-full bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">{offers.length} verified offer{offers.length === 1 ? "" : "s"}</span><span className="rounded-full bg-slate-100 px-3 py-2 text-sm">Prices shown per {product.base_unit}</span></div></div>
    </div>
    <div className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Compare supplier offers</h2><p className="mt-2 text-slate-600">Compare availability, fulfilment and lead time—not price alone.</p></div><Link href={`/request-quote?title=${encodeURIComponent(product.name)}&materials=${encodeURIComponent(`${product.name} — quantity: `)}`} className="btn-secondary">Request bulk quote</Link></div>
      <div className="mt-6 space-y-4">
        {offers.map((offer) => <article className="card grid gap-5 p-5 lg:grid-cols-[1fr_auto_auto] lg:items-center" key={offer.id}>
          <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold">{offer.organisations.name}</h3><BadgeCheck className="h-5 w-5 text-brand-600" aria-label="Approved supplier" />{offer.product_variants && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{offer.product_variants.name}</span>}</div><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600"><span className="flex items-center gap-1"><PackageCheck className="h-4 w-4" />{offer.inventory_mode==="exact_quantity"&&offer.show_exact_stock_to_customers&&offer.stock_quantity!=null?`${offer.stock_quantity} available`:offer.stock_status==="confirmation_required"?"Confirm availability with supplier":offer.stock_status.replaceAll("_"," ")}</span>{offer.supplier_branches && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{offer.supplier_branches.name}, {offer.supplier_branches.city}</span>}<span className="flex items-center gap-1"><Clock3 className="h-4 w-4" />{offer.lead_time_days === 0 ? "Same day" : `${offer.lead_time_days} day lead time`}</span>{offer.delivery_available && <span className="flex items-center gap-1"><Truck className="h-4 w-4" />Delivery</span>}{offer.pickup_available && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />Pickup</span>}</div>{offer.supplier_notes && <p className="mt-3 text-sm text-slate-600">{offer.supplier_notes}</p>}</div>
          <div className="lg:text-right"><p className="text-2xl font-black">GHS {Number(offer.price).toFixed(2)}</p><p className="text-xs text-slate-500">per {product.base_unit}{offer.minimum_order_quantity ? ` · min. ${offer.minimum_order_quantity}` : ""}</p>{offer.wholesale_price && <p className="mt-1 text-sm font-semibold text-brand-700">GHS {Number(offer.wholesale_price).toFixed(2)} wholesale</p>}</div>
          <div className="w-full lg:w-44"><AddToCartButton item={{ listingId: offer.id, name: product.name, supplier: offer.organisations.name, unit: product.base_unit, price: Number(offer.price) }} /></div>
        </article>)}
        {!offers.length && <div className="card p-10 text-center text-slate-500">No supplier has a published offer for this product right now. Request a quote and BuildMate will help source it.</div>}
      </div>
    </div>
  </section>;
}
