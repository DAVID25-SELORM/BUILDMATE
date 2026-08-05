"use client";

import { useState } from "react";
import { saveListing } from "@/app/supplier/products/actions";

export function ListingForm({ products }: { products: { id: string; name: string; base_unit: string }[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return <form className="card grid gap-4 p-6 md:grid-cols-3" action={async (formData) => { setPending(true); const result = await saveListing(formData); setPending(false); setMessage(result.error ?? "Listing saved"); }}>
    <h2 className="text-xl font-bold md:col-span-3">Publish a product listing</h2>
    <label className="md:col-span-2"><span className="label">Catalogue product</span><select className="input" name="productId" required><option value="">Choose product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} / {product.base_unit}</option>)}</select></label>
    <label><span className="label">SKU</span><input className="input" name="sku" /></label>
    <label><span className="label">Retail price (GHS)</span><input className="input" name="price" type="number" min="0" step="0.01" required /></label>
    <label><span className="label">Wholesale price</span><input className="input" name="wholesalePrice" type="number" min="0" step="0.01" /></label>
    <label><span className="label">Wholesale minimum</span><input className="input" name="wholesaleMinimum" type="number" min="0" step="0.01" /></label>
    <label><span className="label">Stock quantity</span><input className="input" name="stockQuantity" type="number" min="0" step="0.01" /></label>
    <label><span className="label">Stock status</span><select className="input" name="stockStatus" defaultValue="confirmation_required"><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option><option value="confirmation_required">Confirmation required</option><option value="available_on_order">Available on order</option></select></label>
    <label><span className="label">Lead time (days)</span><input className="input" name="leadTimeDays" type="number" min="0" defaultValue="1" required /></label>
    <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked /> Active</label>
    {message && <p className="text-sm font-medium md:col-span-3" role="status">{message}</p>}
    <button className="btn-primary md:col-span-3" disabled={pending}>{pending ? "Saving..." : "Publish listing"}</button>
  </form>;
}
