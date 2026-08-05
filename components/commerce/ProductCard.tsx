import { MapPin, Star } from "lucide-react";
import { AddToCartButton } from "./AddToCartButton";
export type Product = { listingId?:string; name: string; category: string; price: number; unit: string; supplier: string; location?: string; rating?: number };
export function ProductCard({ product }: { product: Product }) {
  return <article className="card overflow-hidden"><div className="flex h-44 items-center justify-center bg-gradient-to-br from-slate-100 to-sand-100 text-5xl">🏗️</div><div className="p-5">
    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{product.category}</p><h3 className="mt-2 font-bold">{product.name}</h3>
    <p className="mt-3 text-2xl font-bold">GH₵ {product.price.toFixed(2)} <span className="text-sm font-normal text-slate-500">/{product.unit}</span></p>
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600"><span>{product.supplier}</span>{product.rating != null && <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-current"/> {product.rating}</span>}</div>
    {product.location && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5"/>{product.location}</p>}
    {product.listingId?<AddToCartButton item={{listingId:product.listingId,name:product.name,supplier:product.supplier,unit:product.unit,price:product.price}}/>:<button className="btn-primary mt-5 w-full py-2.5">View product</button>}
  </div></article>;
}
