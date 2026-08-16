"use client";

import { useMemo, useState } from "react";
import { createListingDrafts } from "@/app/supplier/products/actions";
import {
  LocationFields,
  type SupplierBranchOption,
  type SupplierWarehouseOption,
} from "@/components/supplier/locations/LocationFields";

type Product = {
  id: string;
  name: string;
  base_unit: string;
  category: string;
  brand: string | null;
};

export function CataloguePicker({
  products,
  branches,
  warehouses,
}: {
  products: Product[];
  branches: SupplierBranchOption[];
  warehouses: SupplierWarehouseOption[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const categories = [
    ...new Set(products.map((product) => product.category)),
  ].sort();
  const visible = useMemo(
    () =>
      products.filter(
        (product) =>
          (category === "all" || product.category === category) &&
          `${product.name} ${product.brand ?? ""}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [products, category, query],
  );
  const allVisibleSelected =
    visible.length > 0 &&
    visible.every((product) => selected.includes(product.id));

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Tick products you stock</h2>
          <p className="mt-1 text-sm text-slate-600">
            Select from BuildMate&apos;s catalogue. Drafts are created first;
            add price and availability before publishing.
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-800">
          {selected.length} selected
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_240px_auto]">
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search product or brand"
        />
        <select
          className="input"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary"
          onClick={() =>
            setSelected(
              allVisibleSelected
                ? selected.filter(
                    (id) => !visible.some((product) => product.id === id),
                  )
                : [
                    ...new Set([
                      ...selected,
                      ...visible.map((product) => product.id),
                    ]),
                  ],
            )
          }
        >
          {allVisibleSelected ? "Clear visible" : "Select visible"}
        </button>
      </div>
      <form
        className="mt-5"
        action={async (formData) => {
          setPending(true);
          const result = await createListingDrafts(formData);
          setPending(false);
          setMessage(
            result.error ?? `${result.count ?? 0} draft listings created`,
          );
          if (!result.error) setSelected([]);
        }}
      >
        <div className="mb-4">
          <LocationFields branches={branches} warehouses={warehouses} />
        </div>
        <div className="max-h-96 divide-y overflow-y-auto rounded-xl border border-slate-200">
          {visible.map((product) => (
            <label
              className="flex cursor-pointer items-center gap-3 p-3 hover:bg-slate-50"
              key={product.id}
            >
              <input
                type="checkbox"
                name="productIds"
                value={product.id}
                checked={selected.includes(product.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, product.id]
                      : selected.filter((id) => id !== product.id),
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <b className="block truncate">{product.name}</b>
                <span className="text-xs text-slate-500">
                  {product.category}
                  {product.brand ? ` · ${product.brand}` : ""} · per{" "}
                  {product.base_unit}
                </span>
              </span>
            </label>
          ))}
          {!visible.length && (
            <p className="p-6 text-center text-sm text-slate-500">
              No catalogue products match these filters.
            </p>
          )}
        </div>
        {message && (
          <p className="mt-3 text-sm font-semibold" role="status">
            {message}
          </p>
        )}
        <button
          className="btn-primary mt-4 w-full"
          disabled={pending || !selected.length || !branches.length}
        >
          {pending
            ? "Creating drafts..."
            : `Create ${selected.length || ""} draft listing${selected.length === 1 ? "" : "s"}`}
        </button>
      </form>
    </section>
  );
}
