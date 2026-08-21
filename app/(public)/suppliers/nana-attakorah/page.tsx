import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CheckCircle2, Clock3, MapPin, PackageCheck, Phone, ShieldCheck, Truck } from "lucide-react";
import { ProductCard, type Product } from "@/components/commerce/ProductCard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Nana Attakorah II Ventures | BuildMate Ghana",
  description: "Shop timber, steel, tools, paint and general building materials from Nana Attakorah II Ventures in Kwashieman, Accra.",
};

const products = [
  { name: "Sawn hardwood timber", category: "Timber & wood", unit: "piece", image: "sawn-timber.jpg", note: "Confirm species, lengths and profiles" },
  { name: "Bamboo construction poles", category: "Timber & wood", unit: "piece", image: "wood-poles.jpg", note: "For formwork and temporary support" },
  { name: "High-tensile reinforcement bars", category: "Steel & reinforcement", unit: "length", image: "steel-bars.jpg", note: "Confirm diameter, grade and length" },
  { name: "Roofing sheets & wire mesh", category: "Roofing & steel", unit: "sheet or roll", image: "hardware-stock.jpg", note: "Confirm profile, gauge and dimensions" },
  { name: "Construction wheelbarrows", category: "Site tools", unit: "unit", image: "wheelbarrows.jpg", note: "Confirm tray type and wheel configuration" },
  { name: "Shovels, spades & metal pans", category: "Site tools", unit: "unit", image: "metal-fittings.jpg", note: "Ask for the exact tool and size" },
  { name: "Interior & exterior paint", category: "Paint & finishes", unit: "bucket", image: "paint-stock.jpg", note: "Confirm brand, colour, finish and size" },
  { name: "PVC & metal building fittings", category: "Hardware & fittings", unit: "piece", image: "shop-front.jpg", note: "Ask for fitting type and available sizes" },
];

const gallery = [
  ["timber-yard.jpg", "Timber inventory at the Nana Attakorah yard"],
  ["hardware-stock.jpg", "Hardware and building accessories in stock"],
  ["shop-front.jpg", "General building materials inside the shop"],
  ["storefront.jpg", "Nana Attakorah II Ventures storefront"],
] as const;

export default async function NanaAttakorahStorefront() {
  const supabase = await createClient();
  const { data } = await supabase.from("supplier_listings").select("id,product_id,price,stock_status,inventory_mode,delivery_available,pickup_available,products!inner(name,base_unit,images,categories(name)),product_variants(name),supplier_branches(name,city),product_media(storage_path,alt_text,is_cover,sort_order)").eq("supplier_id","9b232d45-65f6-4f7d-83d5-d0907f98b4ff").eq("listing_status","published").eq("is_active",true).not("branch_id","is",null).or("and(inventory_mode.eq.exact_quantity,stock_quantity.gt.0),and(inventory_mode.eq.status_only,stock_status.eq.in_stock)").order("price");
  const published = (data ?? []).map((row) => {
    const product = row.products as unknown as {name:string;base_unit:string;images:string[];categories:{name:string}|null};
    const variant = row.product_variants as unknown as {name:string}|null;
    const branch = row.supplier_branches as unknown as {name:string;city:string}|null;
    const media = [...((row.product_media ?? []) as {storage_path:string;alt_text:string;is_cover:boolean;sort_order:number}[])].sort((a,b)=>Number(b.is_cover)-Number(a.is_cover)||a.sort_order-b.sort_order)[0];
    return {listingId:row.id,productId:row.product_id,name:product.name,category:product.categories?.name??"Materials",price:Number(row.price),unit:product.base_unit,supplier:"Nana Attakorah II Ventures",variant:variant?.name??null,variants:variant?[variant.name]:[],location:branch?[branch.name,branch.city].filter(Boolean).join(", "):undefined,availabilityLabel:row.inventory_mode==="confirmation_required"||row.stock_status==="confirmation_required"?"Confirm availability with supplier":"Available",deliveryAvailable:row.delivery_available,pickupAvailable:row.pickup_available,imageUrl:media?supabase.storage.from("product-media").getPublicUrl(media.storage_path).data.publicUrl:product.images?.[0],imageAlt:media?.alt_text} satisfies Product;
  });
  return <>
    <section className="relative isolate overflow-hidden bg-slate-950 text-white">
      <Image src="/images/suppliers/nana-attakorah/timber-yard.jpg" alt="Stacked timber at Nana Attakorah II Ventures" fill priority sizes="100vw" className="-z-20 object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-900/30" />
      <div className="container-shell py-16 sm:py-24">
        <Link href="/shop" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"><span aria-hidden>←</span> Back to marketplace</Link>
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-bold text-emerald-200 ring-1 ring-emerald-300/30"><BadgeCheck className="h-4 w-4" /> Field visited</span>
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium ring-1 ring-white/20">Building materials supplier</span>
          </div>
          <h1 className="mt-6 text-4xl font-black leading-tight sm:text-6xl">Nana Attakorah II Ventures</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">Timber, steel, tools, paint, doors and general building materials for contractors, artisans and homeowners.</p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-200">
            <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Kwashieman, near Ecobank, Accra</span>
            <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Local pickup & delivery enquiries</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/request-quote?title=Nana%20Attakorah%20materials%20request&location=Kwashieman%2C%20Accra" className="btn-primary bg-white text-brand-800 hover:bg-slate-100">Request a quote <ArrowRight className="ml-2 h-4 w-4" /></Link>
            <a href="tel:+23324329268" className="inline-flex items-center justify-center rounded-xl border border-white/50 px-5 py-3 font-semibold hover:bg-white/10"><Phone className="mr-2 h-4 w-4" /> Call supplier</a>
          </div>
        </div>
      </div>
    </section>

    <section className="border-b border-slate-200 bg-white">
      <div className="container-shell grid gap-4 py-6 sm:grid-cols-3">
        {[
          [ShieldCheck, "Site-verified inventory", "Photographed by the BuildMate team"],
          [PackageCheck, "Trade quantities", "Single-item and bulk enquiries"],
          [Truck, "Delivery support", "Confirm destination when requesting a quote"],
        ].map(([Icon, title, copy]) => <div key={String(title)} className="flex items-start gap-3 rounded-2xl bg-sand-50 p-4">
          <Icon className="mt-0.5 h-6 w-6 shrink-0 text-brand-700" />
          <div><p className="font-bold">{String(title)}</p><p className="mt-1 text-sm text-slate-600">{String(copy)}</p></div>
        </div>)}
      </div>
    </section>

    <section className="container-shell py-14 sm:py-16">
      <p className="font-semibold text-brand-700">PUBLISHED MARKETPLACE OFFERS</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-black">Available products from this supplier</h2><p className="mt-2 text-slate-600">{published.length} priced offer{published.length===1?"":"s"} currently published on BuildMate.</p></div><Link href="/shop" className="btn-secondary">Browse all products</Link></div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{published.map((product)=><ProductCard key={product.listingId} product={product}/>)}</div>
      {!published.length&&<div className="card mt-8 p-8 text-center text-slate-600">No priced offers from this supplier are currently published.</div>}
    </section>

    <section className="border-t border-slate-200 bg-sand-50"><div className="container-shell py-14 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-semibold text-brand-700">AVAILABLE ON ENQUIRY</p><h2 className="mt-2 text-3xl font-black">Additional materials observed at this supplier</h2><p className="mt-3 text-slate-600">These field-visited items are not published priced offers. Prices, quantities and exact specifications require supplier confirmation.</p></div>
        <Link href="/request-quote?title=Nana%20Attakorah%20materials%20request&location=Kwashieman%2C%20Accra" className="btn-secondary">Request multiple items</Link>
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map(product => <article key={product.name} className="card group overflow-hidden">
          <div className="relative aspect-[4/3] overflow-hidden bg-slate-100"><Image src={`/images/suppliers/nana-attakorah/${product.image}`} alt={`${product.name} available at Nana Attakorah II Ventures`} fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" /></div>
          <div className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-brand-700">{product.category}</p><h3 className="mt-2 text-xl font-bold">{product.name}</h3><p className="mt-2 text-sm text-slate-600">{product.note} · sold per {product.unit}</p><Link href={`/request-quote?title=${encodeURIComponent(`Nana Attakorah — ${product.name}`)}&materials=${encodeURIComponent(`${product.name} — quantity: `)}&location=Kwashieman%2C%20Accra`} className="mt-5 inline-flex items-center gap-2 font-bold text-brand-700 hover:text-brand-900">Ask for price <ArrowRight className="h-4 w-4" /></Link></div>
        </article>)}
      </div>
    </div></section>

    <section className="bg-white py-14 sm:py-16">
      <div className="container-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div><p className="font-semibold text-brand-700">BUY WITH CONFIDENCE</p><h2 className="mt-2 text-3xl font-black">A real supplier, visited by BuildMate</h2><p className="mt-4 leading-7 text-slate-600">The BuildMate team visited the business and documented its current yard, shop and product range. Availability can change, so every order starts with a confirmed quotation.</p>
          <ul className="mt-6 grid gap-3 text-sm">{["Business and location details recorded", "Inventory photographed on site", "Quote confirmed before payment", "Delivery requirements agreed in advance"].map(item => <li key={item} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-brand-600" />{item}</li>)}</ul>
        </div>
        <div className="grid grid-cols-2 gap-3">{gallery.map(([src, alt], index) => <div key={src} className={`relative overflow-hidden rounded-2xl ${index === 0 ? "row-span-2 min-h-80" : "min-h-40"}`}><Image src={`/images/suppliers/nana-attakorah/${src}`} alt={alt} fill sizes="(max-width:1024px) 50vw, 30vw" className="object-cover" /></div>)}</div>
      </div>
    </section>

    <section className="container-shell py-14"><div className="overflow-hidden rounded-3xl bg-brand-900 p-8 text-white md:flex md:items-center md:justify-between md:p-12"><div><p className="text-sm font-bold uppercase tracking-wider text-brand-100">Need materials for a project?</p><h2 className="mt-2 text-3xl font-black">Send your list and get a confirmed quote.</h2><p className="mt-3 max-w-2xl text-brand-100">Include quantities, sizes and delivery location for a faster response.</p></div><Link href="/request-quote?title=Nana%20Attakorah%20materials%20request&location=Kwashieman%2C%20Accra" className="mt-6 inline-flex shrink-0 rounded-xl bg-white px-6 py-3 font-bold text-brand-900 md:ml-8 md:mt-0">Start request</Link></div></section>
  </>;
}
