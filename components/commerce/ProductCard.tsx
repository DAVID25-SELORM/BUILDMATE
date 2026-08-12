import Image from "next/image";
import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { AddToCartButton } from "./AddToCartButton";

export type Product = { listingId?: string; productId?: string; supplierCount?: number; name: string; category: string; price: number; unit: string; supplier: string; location?: string; rating?: number; imageUrl?: string; imageAlt?: string };

function fallback(name: string) { const value = name.toLowerCase(); if (value.includes("steel") || value.includes("rod")) return "steel-reinforcement.webp"; if (value.includes("roof")) return "roofing-installation.webp"; if (value.includes("tile")) return "tiles-flooring.webp"; if (value.includes("paint")) return "paint-finishes.webp"; if (value.includes("block")) return "blocks-and-bricks.webp"; return "cement-and-concrete.webp"; }

export function ProductCard({ product }: { product: Product }) {
  return <article className="card overflow-hidden"><div className="relative h-44"><Image src={product.imageUrl ?? `/images/categories/${fallback(product.name)}`} alt={product.imageAlt ?? `${product.name} category illustration; supplier product photograph not yet available`} fill sizes="(max-width:768px) 100vw,25vw" className="object-cover" /></div><div className="p-5">
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{product.category}</p><h3 className="mt-2 font-bold">{product.name}</h3>
    <p className="mt-3 text-2xl font-bold">{product.supplierCount ? "From " : ""}GHS {product.price.toFixed(2)} <span className="text-sm font-normal text-slate-500">/{product.unit}</span></p>
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600"><span>{product.supplier}</span>{product.rating != null && <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-current" /> {product.rating}</span>}</div>
    {product.location && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{product.location}</p>}
    {product.listingId ? <AddToCartButton item={{ listingId: product.listingId, name: product.name, supplier: product.supplier, unit: product.unit, price: product.price }} /> : <Link href={product.productId ? `/shop/${product.productId}` : `/shop?q=${encodeURIComponent(product.name)}`} className="btn-primary mt-5 block w-full py-2.5 text-center">{product.productId ? "Compare offers" : "Find suppliers"}</Link>}
  </div></article>;
}
