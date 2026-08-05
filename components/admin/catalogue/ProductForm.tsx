"use client";

import { useState } from "react";
import { saveProduct } from "@/app/admin/catalogue/actions";

type Option = { id: string; name: string };

export function ProductForm({ categories, brands }: { categories: Option[]; brands: Option[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return <form className="card grid gap-4 p-6 md:grid-cols-2" action={async (formData) => {
    setPending(true);
    const result = await saveProduct(formData);
    setPending(false);
    setMessage(result.error ?? "Product saved");
  }}>
    <div className="md:col-span-2"><h2 className="text-xl font-bold">Add catalogue product</h2></div>
    <label><span className="label">Name</span><input className="input" name="name" required /></label>
    <label><span className="label">Slug</span><input className="input" name="slug" placeholder="ordinary-portland-cement" required /></label>
    <label><span className="label">Category</span><select className="input" name="categoryId" required><option value="">Choose category</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span className="label">Brand</span><select className="input" name="brandId"><option value="">No brand</option>{brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span className="label">Base unit</span><input className="input" name="baseUnit" placeholder="bag" required /></label>
    <label className="flex items-end gap-2 pb-3"><input type="checkbox" name="isActive" defaultChecked /> Active</label>
    <label className="md:col-span-2"><span className="label">Description</span><textarea className="input min-h-24" name="description" /></label>
    {message && <p className="text-sm font-medium md:col-span-2" role="status">{message}</p>}
    <button className="btn-primary md:col-span-2" disabled={pending}>{pending ? "Saving..." : "Add product"}</button>
  </form>;
}
