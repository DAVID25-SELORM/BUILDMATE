"use client";

import { useMemo, useState } from "react";
import { createSupplierInventoryDrafts } from "@/app/admin/suppliers/[id]/inventory-actions";

type Product = { id: string; name: string; base_unit: string; category: string; brand: string | null };

export function AdminCataloguePicker({ supplierId, products }: { supplierId: string; products: Product[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const visible = useMemo(() => products.filter((product) =>
    `${product.name} ${product.category} ${product.brand ?? ""}`.toLowerCase().includes(query.toLowerCase()),
  ), [products, query]);

  return <section className="card p-6" data-supplier-tab="inventory">
    <h2 className="text-lg font-bold">Add site-visit inventory</h2>
    <p className="mt-1 text-sm text-slate-600">Create supplier-owned drafts from BuildMate&apos;s catalogue. Drafts stay private until the supplier confirms price and availability.</p>
    <input className="input mt-4" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, categories or brands" />
    <form className="mt-4" action={async (formData) => {
      setPending(true);
      const result = await createSupplierInventoryDrafts(supplierId, formData);
      setPending(false);
      setMessage(result.error ?? `${result.count ?? 0} drafts created${result.existing ? `; ${result.existing} already existed` : ""}.`);
      if (!result.error) setSelected([]);
    }}>
      <div className="max-h-80 divide-y overflow-y-auto rounded-xl border border-slate-200">
        {visible.map((product) => <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50" key={product.id}>
          <input type="checkbox" name="productIds" value={product.id} checked={selected.includes(product.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, product.id] : selected.filter((id) => id !== product.id))} />
          <span className="min-w-0 flex-1"><b className="block truncate">{product.name}</b><span className="text-xs text-slate-500">{product.category}{product.brand ? ` · ${product.brand}` : ""} · per {product.base_unit}</span></span>
        </label>)}
        {!visible.length && <p className="p-6 text-center text-sm text-slate-500">No matching catalogue products.</p>}
      </div>
      {message && <p className="mt-3 text-sm font-semibold" role="status">{message}</p>}
      <button className="btn-primary mt-4 w-full" disabled={pending || !selected.length}>{pending ? "Creating drafts..." : `Create ${selected.length || ""} inventory draft${selected.length === 1 ? "" : "s"}`}</button>
    </form>
  </section>;
}
