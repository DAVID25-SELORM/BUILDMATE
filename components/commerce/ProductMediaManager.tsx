"use client";

import Image from "next/image";
import { useActionState } from "react";
import { deleteProductImage, setProductCover, uploadProductImage, type MediaState } from "@/app/supplier/products/media-actions";

export type ListingMedia = { id: string; name: string; media: { id: string; url: string; altText: string; isCover: boolean }[] };
const initial: MediaState = { message: "" };

export function ProductMediaManager({ listings }: { listings: ListingMedia[] }) {
  const [state, action, pending] = useActionState(uploadProductImage, initial);
  if (!listings.length) return null;
  return <section className="card mt-6 p-6"><h2 className="text-xl font-black">Product galleries</h2><p className="mt-1 text-sm text-slate-600">Upload up to 8 genuine photos per listing. JPG, PNG or WebP, maximum 5 MB. Only upload images you own or may legally use.</p>
    {listings.map(listing => <div className="mt-6 border-t pt-5" key={listing.id}><h3 className="font-bold">{listing.name}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{listing.media.map(item => <figure className="overflow-hidden rounded-xl border" key={item.id}><div className="relative aspect-square"><Image src={item.url} alt={item.altText} fill sizes="(min-width:1024px) 20vw, 50vw" className="object-cover" /></div><figcaption className="p-3 text-xs"><p className="line-clamp-2">{item.altText}</p><div className="mt-2 flex gap-3">{item.isCover ? <b className="text-brand-700">Cover</b> : <form action={setProductCover.bind(null, item.id, listing.id)}><button className="font-semibold text-brand-700">Make cover</button></form>}<form action={deleteProductImage.bind(null, item.id)}><button className="font-semibold text-red-700">Delete</button></form></div></figcaption></figure>)}{!listing.media.length && <p className="text-sm text-slate-500">No product photos yet.</p>}</div>
      {listing.media.length < 8 && <form action={action} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="listingId" value={listing.id} /><input className="input" name="altText" required minLength={5} maxLength={240} placeholder="Describe the product photo" /><input className="input" name="image" type="file" required accept="image/jpeg,image/png,image/webp" /><button className="btn-secondary" disabled={pending}>{pending ? "Uploading…" : "Add image"}</button></form>}
    </div>)}
    {state.message && <p className={`mt-4 text-sm font-semibold ${state.ok ? "text-green-700" : "text-red-700"}`} role="status">{state.message}</p>}
  </section>;
}
