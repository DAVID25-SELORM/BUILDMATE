"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { createProductForSale, requestCatalogueProduct } from "@/app/supplier/products/actions";

type Product = { id: string; name: string; base_unit: string; category: string };
type Variant = { id: string; product_id: string; name: string };
type Branch = { id: string; name: string; is_main_branch?: boolean | null };

export function SimplifiedAddProductForm({ products, variants, branches, readOnly = false }: {
  products: Product[]; variants: Variant[]; branches: Branch[]; readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(createProductForSale, {});
  const [requestState, requestAction, requestPending] = useActionState(requestCatalogueProduct, {});
  const [reviewing, setReviewing] = useState(false);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [branchId, setBranchId] = useState(branches.length === 1 ? branches[0].id : "");
  const [delivery, setDelivery] = useState(true);
  const [pickup, setPickup] = useState(true);
  const product = products.find((item) => item.id === productId);
  const variant = variants.find((item) => item.id === variantId);
  const availableVariants = useMemo(() => variants.filter((item) => item.product_id === productId), [variants, productId]);
  const branch = branches.find((item) => item.id === branchId);

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-xl font-black">Add Product</h2>
      <p className="mt-1 text-sm text-slate-600">Product + price + quantity + fulfilment = ready to sell.</p>
      {readOnly && <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">Preview only. Product and stock changes are disabled.</div>}
      <form action={action} className="mt-5 grid gap-4" onSubmit={(event) => {
        if (readOnly) { event.preventDefault(); return; }
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.value === "publish" && !reviewing) { event.preventDefault(); setReviewing(true); }
      }}>
        {!reviewing ? <>
          <label><span className="label">Product</span><select className="input" name="productId" required value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId(""); }}>
            <option value="">Search or choose a BuildMate product</option>
            {products.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}
          </select></label>
          {availableVariants.length > 0 && <label><span className="label">Variant / specification</span><select className="input" name="variantId" value={variantId} onChange={(e) => setVariantId(e.target.value)} required>
            <option value="">Choose variant</option>{availableVariants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>}
          {!availableVariants.length && <input type="hidden" name="variantId" value="" />}
          {branches.length === 1 ? <div className="rounded-xl bg-brand-50 p-4"><span className="block text-xs font-bold uppercase text-brand-700">Location</span><b>{branches[0].name}</b><input type="hidden" name="branchId" value={branches[0].id} /></div> : <label><span className="label">Branch</span><select className="input" name="branchId" required value={branchId} onChange={(e) => setBranchId(e.target.value)}><option value="">Choose branch</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">Selling Price (GHS)</span><input className="input" name="price" type="number" min="0.01" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} /><small className="text-slate-500">The price customers will see.</small></label>
            <label><span className="label">Quantity Available</span><input className="input" name="quantity" type="number" min="0.01" step="0.01" required value={quantity} onChange={(e) => setQuantity(e.target.value)} /><small className="text-slate-500">Unit: {product?.base_unit ?? "select a product"}</small></label>
            <label><span className="label">Purchase Cost Per Unit (GHS)</span><input className="input" name="unitCost" type="number" min="0.01" step="0.01" required value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /><small className="text-slate-500">What you paid for one unit of this stock.</small></label>
          </div>
          <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="label px-1">Customers can receive it by</legend><div className="flex flex-wrap gap-6"><label className="flex gap-2"><input type="checkbox" name="deliveryAvailable" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} /> Delivery</label><label className="flex gap-2"><input type="checkbox" name="pickupAvailable" checked={pickup} onChange={(e) => setPickup(e.target.checked)} /> Pickup</label></div></fieldset>
          <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold">More options</summary><div className="mt-4 grid gap-4"><label><span className="label">Supplier SKU</span><input className="input" name="sku" /></label><label><span className="label">Notes</span><textarea className="input min-h-20" name="notes" /></label></div></details>
        </> : <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5"><h3 className="text-xl font-black">Ready to Sell</h3><dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt>Product</dt><dd className="font-bold">{product?.name}</dd>{variant && <><dt>Variant</dt><dd className="font-bold">{variant.name}</dd></>}<dt>Selling price</dt><dd className="font-bold">GHS {Number(price).toFixed(2)} / {product?.base_unit}</dd><dt>Available</dt><dd className="font-bold">{quantity} {product?.base_unit}</dd><dt>Location</dt><dd className="font-bold">{branch?.name}</dd><dt>Fulfilment</dt><dd className="font-bold">{[delivery && "Delivery", pickup && "Pickup"].filter(Boolean).join(" + ")}</dd></dl></div>}
        {reviewing && <><input type="hidden" name="productId" value={productId} /><input type="hidden" name="variantId" value={variantId} /><input type="hidden" name="branchId" value={branchId} /><input type="hidden" name="price" value={price} /><input type="hidden" name="quantity" value={quantity} /><input type="hidden" name="unitCost" value={unitCost} />{delivery && <input type="hidden" name="deliveryAvailable" value="on" />}{pickup && <input type="hidden" name="pickupAvailable" value="on" />}</>}
        {state.error && <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">{state.error}{state.listingId && <span className="ml-2"><Link className="underline" href="#product-list">Edit existing product</Link> · <Link className="underline" href={`/supplier/inventory?listing=${state.listingId}`}>Add stock</Link></span>}</div>}
        {state.message && <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">{state.message}{state.stockReference && ` Stock reference: ${state.stockReference}`}</div>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{reviewing && <button type="button" className="btn-secondary" onClick={() => setReviewing(false)}>Back</button>}<button className="btn-secondary" name="intent" value="draft" disabled={pending || readOnly}>{pending ? "Saving…" : "Save Draft"}</button><button className="btn-primary" name="intent" value="publish" disabled={pending || readOnly}>{pending ? "Publishing…" : reviewing ? "Publish Product" : "Save & Publish"}</button></div>
      </form>
      <details className="mt-5 border-t pt-4"><summary className="cursor-pointer font-bold text-brand-800">Can’t find your product? Request Product</summary><form action={requestAction} className="mt-4 grid gap-3"><input className="input" name="productName" placeholder="Product name" required /><input className="input" name="category" placeholder="Category" required /><textarea className="input min-h-20" name="description" placeholder="Description or specification" required /><label><span className="label">Product image <span className="font-normal text-slate-500">(optional)</span></span><input className="input" name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>{requestState.error && <p className="text-sm text-red-700">{requestState.error}</p>}{requestState.message && <p className="text-sm text-emerald-700">{requestState.message}</p>}<button className="btn-secondary" disabled={requestPending || readOnly}>{requestPending ? "Sending…" : "Send Product Request"}</button></form></details>
    </section>
  );
}
