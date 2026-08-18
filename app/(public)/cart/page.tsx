"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CartItem } from "@/lib/cart/cart";
import { cartTotal, normalizeQuantity, readCart, writeCart } from "@/lib/cart/cart";

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setItems(readCart()), 0); return () => clearTimeout(timer); }, []);
  function save(next: CartItem[]) { setItems(next); writeCart(next); }
  async function checkout() {
    setPending(true); setError(null);
    const response = await fetch("/api/cart/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, address }) });
    const result = await response.json();
    if (!response.ok) { if(response.status===409&&Array.isArray(result.priceChanges)){const changes=new Map<string,number>(result.priceChanges.map((change:{listingId:string;newPrice:number})=>[change.listingId,change.newPrice]));save(items.map((item)=>changes.has(item.listingId)?{...item,price:changes.get(item.listingId)!}:item));}setError(result.error); setPending(false); if (response.status === 401) router.push("/login?redirect=/cart"); return; }
    save([]); router.push("/dashboard/orders");
  }
  return <section className="container-shell py-12"><h1 className="text-4xl font-black">Your cart</h1><div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]"><div className="card divide-y">{items.map((item) => <div className="grid gap-3 p-5 md:grid-cols-[1fr_auto_auto]" key={item.listingId}><div><b>{item.name}{item.variant ? ` — ${item.variant}` : ""}</b><p className="text-sm text-slate-500">{item.supplier} · GHS {item.price.toFixed(2)}/{item.unit}</p>{item.availabilityLabel && <p className="mt-1 text-xs font-semibold text-amber-800">{item.availabilityLabel}</p>}</div><input aria-label={`Quantity for ${item.name}`} className="input w-24" type="number" min="1" value={item.quantity} onChange={(event) => save(items.map((line) => line.listingId === item.listingId ? { ...line, quantity: normalizeQuantity(Number(event.target.value)) } : line))} /><button type="button" className="text-sm font-semibold text-red-600" onClick={() => save(items.filter((line) => line.listingId !== item.listingId))}>Remove</button></div>)}{items.length === 0 && <p className="p-8 text-center text-slate-500">Your cart is empty. <Link className="font-bold text-brand-700" href="/shop">Start shopping</Link></p>}</div><aside className="card h-fit p-6"><div className="flex justify-between text-xl font-black"><span>Total</span><span>GHS {cartTotal(items).toFixed(2)}</span></div><label className="mt-5 block"><span className="label">Delivery address</span><textarea className="input" value={address} onChange={(event) => setAddress(event.target.value)} required /></label>{error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}<button className="btn-primary mt-5 w-full" disabled={pending || items.length === 0} onClick={checkout}>{pending ? "Creating orders..." : "Continue to checkout"}</button>{items.length > 0 && <button type="button" className="mt-3 w-full text-sm font-semibold text-red-700" onClick={() => save([])}>Clear cart</button>}<p className="mt-3 text-xs text-slate-500">Build your cart as a guest. Sign in only when placing the order. Prices and availability are securely revalidated at checkout.</p></aside></div></section>;
}
