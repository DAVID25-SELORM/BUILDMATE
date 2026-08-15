"use client";

import { useState } from "react";
import { saveListing } from "@/app/supplier/products/actions";

type ProductOption = { id: string; name: string; base_unit: string };
type ListingInitial = {
  id: string;
  productId: string;
  sku?: string | null;
  price?: number | string | null;
  wholesalePrice?: number | string | null;
  wholesaleMinimum?: number | string | null;
  stockQuantity?: number | string | null;
  stockStatus?: string;
  leadTimeDays?: number;
  minimumOrderQuantity?: number | string | null;
  deliveryAvailable?: boolean;
  pickupAvailable?: boolean;
  supplierNotes?: string | null;
  listingStatus?: string;
  branchId?: string | null;
  warehouseId?: string | null;
};

type Location = { id: string; name: string };
export function ListingForm({ products, initial, branches = [], warehouses = [] }: { products: ProductOption[]; initial?: ListingInitial; branches?: Location[]; warehouses?: Location[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const editing = Boolean(initial);

  return <form className="card grid gap-4 p-6 md:grid-cols-3" action={async (formData) => {
    setPending(true);
    const result = await saveListing(formData);
    setPending(false);
    setMessage(result.error ?? "Listing saved");
  }}>
    <h2 className="text-xl font-bold md:col-span-3">{editing ? "Complete draft listing" : "Add one product manually"}</h2>
    {initial && <input type="hidden" name="id" value={initial.id} />}
    <label className="md:col-span-2"><span className="label">Catalogue product</span><select className="input" name="productId" required defaultValue={initial?.productId ?? ""} disabled={editing}><option value="">Choose product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} / {product.base_unit}</option>)}</select>{editing && <input type="hidden" name="productId" value={initial?.productId} />}</label>
    <label><span className="label">Supplier SKU</span><input className="input" name="sku" defaultValue={initial?.sku ?? ""} /></label>
    <label><span className="label">Retail price (GHS)</span><input className="input" name="price" type="number" min="0" step="0.01" defaultValue={initial?.price ?? ""} /></label>
    <label><span className="label">Wholesale price</span><input className="input" name="wholesalePrice" type="number" min="0" step="0.01" defaultValue={initial?.wholesalePrice ?? ""} /></label>
    <label><span className="label">Wholesale minimum</span><input className="input" name="wholesaleMinimum" type="number" min="0" step="0.01" defaultValue={initial?.wholesaleMinimum ?? ""} /></label>
    <label><span className="label">Stock quantity <span className="font-normal text-slate-500">(optional)</span></span><input className="input" name="stockQuantity" type="number" min="0" step="0.01" defaultValue={initial?.stockQuantity ?? ""} /></label>
    <label><span className="label">Stock status</span><select className="input" name="stockStatus" defaultValue={initial?.stockStatus ?? "confirmation_required"}><option value="in_stock">In stock</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option><option value="confirmation_required">Confirm availability</option><option value="available_on_order">Available on order</option></select></label>
    <label><span className="label">Minimum order</span><input className="input" name="minimumOrderQuantity" type="number" min="0.01" step="0.01" defaultValue={initial?.minimumOrderQuantity ?? ""} /></label>
    <label><span className="label">Lead time (days)</span><input className="input" name="leadTimeDays" type="number" min="0" defaultValue={initial?.leadTimeDays ?? 1} required /></label>
    <label><span className="label">Branch</span><select className="input" name="branchId" defaultValue={initial?.branchId ?? ""}><option value="">No branch assignment</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span className="label">Warehouse</span><select className="input" name="warehouseId" defaultValue={initial?.warehouseId ?? ""}><option value="">No warehouse</option>{warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <fieldset className="flex items-center gap-5 rounded-xl border border-slate-200 px-4 py-3"><legend className="sr-only">Fulfilment</legend><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="deliveryAvailable" defaultChecked={initial?.deliveryAvailable ?? true} /> Delivery</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pickupAvailable" defaultChecked={initial?.pickupAvailable ?? true} /> Pickup</label></fieldset>
    <label><span className="label">Listing status</span><select className="input" name="listingStatus" defaultValue={initial?.listingStatus ?? "draft"}><option value="draft">Save as draft</option><option value="published">Publish</option><option value="out_of_stock">Out of stock</option><option value="seasonal">Seasonal</option><option value="discontinued">Discontinued</option></select></label>
    <label className="md:col-span-3"><span className="label">Supplier notes</span><textarea className="input min-h-20" name="supplierNotes" defaultValue={initial?.supplierNotes ?? ""} placeholder="Sizes, packaging, collection instructions or availability notes" /></label>
    {message && <p className="text-sm font-medium md:col-span-3" role="status">{message}</p>}
    <button className="btn-primary md:col-span-3" disabled={pending}>{pending ? "Saving..." : editing ? "Save listing" : "Create listing"}</button>
  </form>;
}
