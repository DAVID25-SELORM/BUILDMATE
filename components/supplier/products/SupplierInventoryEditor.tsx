"use client";

import { useMemo, useState } from "react";
import {
  bulkUpdateListings,
  quickUpdateListing,
  setListingActive,
} from "@/app/supplier/products/actions";
import {
  listingCompletion,
  listingSummary,
} from "@/lib/catalogue/listing-completion";

type Location = {
  id: string;
  name: string;
  branch_id?: string | null;
  is_main_branch?: boolean | null;
};
export type InventoryListing = {
  id: string;
  product_id: string;
  sku: string | null;
  price: number | string | null;
  product_variant_id?: string | null;
  currency?: string | null;
  price_effective_date?: string | null;
  updated_at?: string | null;
  wholesale_price?: number | string | null;
  wholesale_minimum?: number | string | null;
  stock_quantity: number | string | null;
  stock_status: string;
  inventory_mode?: string;
  listing_status: string;
  lead_time_days: number;
  minimum_order_quantity?: number | string | null;
  supplier_notes?: string | null;
  delivery_available: boolean;
  pickup_available: boolean;
  branch_id: string | null;
  warehouse_id: string | null;
  products:
    | { name: string; base_unit: string }
    | { name: string; base_unit: string }[]
    | null;
  product_variants?:
    | { name: string; specifications: Record<string, string> }
    | { name: string; specifications: Record<string, string> }[]
    | null;
  supplier_branches?: { name: string } | { name: string }[] | null;
};

const stockOptions = [
  ["in_stock", "In stock"],
  ["low_stock", "Low stock"],
  ["out_of_stock", "Out of stock"],
  ["confirmation_required", "Confirmation required"],
  ["available_on_order", "Available on order"],
] as const;

export function SupplierInventoryEditor({
  listings,
  branches,
  warehouses,
  canEdit,
  supplierCanPublish,
}: {
  listings: InventoryListing[];
  branches: Location[];
  warehouses: Location[];
  canEdit: boolean;
  supplierCanPublish: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const summary = useMemo(
    () =>
      listingSummary(
        listings.map((listing) => ({
          price: listing.price,
          stockStatus: listing.stock_status,
          deliveryAvailable: listing.delivery_available,
          pickupAvailable: listing.pickup_available,
          branchId: listing.branch_id,
          listingStatus: listing.listing_status,
        })),
        supplierCanPublish,
      ),
    [listings, supplierCanPublish],
  );
  const allSelected =
    listings.length > 0 && selected.length === listings.length;

  const cards = [
    ["Total products", summary.total],
    ["Draft", summary.draft],
    ["Ready to publish", summary.ready],
    ["Published", summary.published],
    ["Out of stock", summary.outOfStock],
    ["Price missing", summary.priceMissing],
    ["Stock confirmation", summary.stockConfirmation],
    ["Needs branch", summary.needsBranch],
  ];

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div className="card p-4" key={label}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>
      {canEdit && (
        <section className="card mt-6 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Bulk completion</h2>
              <p className="mt-1 text-sm text-slate-600">
                Select products, then assign fulfilment and lifecycle settings
                together.
              </p>
            </div>
            <b className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800">
              {selected.length} selected
            </b>
          </div>
          <form
            className="mt-4 grid gap-3 md:grid-cols-3"
            action={async (formData) => {
              setPending(true);
              const result = await bulkUpdateListings(formData);
              setPending(false);
              setMessage(
                result.error ?? `${result.count ?? 0} listings updated`,
              );
              if (!result.error) setSelected([]);
            }}
          >
            {selected.map((id) => (
              <input key={id} type="hidden" name="listingIds" value={id} />
            ))}
            {branches.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 md:col-span-2">
                Create a branch before assigning product inventory.
              </div>
            ) : branches.length === 1 ? (
              <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
                <span className="block text-xs font-bold uppercase text-brand-700">
                  Branch
                </span>
                <b>{branches[0].name}</b>
                {branches[0].is_main_branch && " · Main Branch"}
                <input type="hidden" name="branchId" value={branches[0].id} />
              </div>
            ) : (
              <label>
                <span className="label">Branch</span>
                <select className="input" name="branchId" required>
                  <option value="">Choose branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {warehouses.length === 0 ? (
              <input type="hidden" name="warehouseId" value="" />
            ) : (
              <label>
                <span className="label">
                  Warehouse{" "}
                  <span className="font-normal text-slate-500">(optional)</span>
                </span>
                <select className="input" name="warehouseId">
                  <option value="">No warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span className="label">Stock status</span>
              <select
                className="input"
                name="stockStatus"
                defaultValue="confirmation_required"
              >
                {stockOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Listing status</span>
              <select className="input" name="listingStatus">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="seasonal">Seasonal</option>
                <option value="discontinued">Discontinued</option>
              </select>
            </label>
            <fieldset className="flex items-center gap-5 rounded-xl border border-slate-200 px-4 py-3">
              <legend className="sr-only">Fulfilment</legend>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="deliveryAvailable"
                  defaultChecked
                />{" "}
                Delivery
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="pickupAvailable" defaultChecked />{" "}
                Pickup
              </label>
            </fieldset>
            <button
              className="btn-primary self-end"
              disabled={pending || !selected.length}
            >
              {pending ? "Updating..." : "Update selected"}
            </button>
            {message && (
              <p className="text-sm font-semibold md:col-span-3" role="status">
                {message}
              </p>
            )}
          </form>
        </section>
      )}
      <section className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">
                <input
                  aria-label="Select all products"
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(
                      allSelected ? [] : listings.map((listing) => listing.id),
                    )
                  }
                />
              </th>
              <th>Product / specification</th>
              <th>Price (GHS)</th>
              <th>Stock quantity</th>
              <th>Availability</th>
              <th>Completion</th>
              <th>Quick action</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => {
              const product = Array.isArray(listing.products)
                ? listing.products[0]
                : listing.products;
              const variant = Array.isArray(listing.product_variants)
                ? listing.product_variants[0]
                : listing.product_variants;
              const branch = Array.isArray(listing.supplier_branches)
                ? listing.supplier_branches[0]
                : listing.supplier_branches;
              const completion = listingCompletion(
                {
                  price: listing.price,
                  stockStatus: listing.stock_status,
                  deliveryAvailable: listing.delivery_available,
                  pickupAvailable: listing.pickup_available,
                  branchId: listing.branch_id,
                  listingStatus: listing.listing_status,
                },
                supplierCanPublish,
              );
              return (
                <tr
                  className="border-b align-top last:border-0"
                  key={listing.id}
                >
                  <td className="p-4">
                    <input
                      aria-label={`Select ${product?.name ?? "product"}`}
                      type="checkbox"
                      checked={selected.includes(listing.id)}
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? [...selected, listing.id]
                            : selected.filter((id) => id !== listing.id),
                        )
                      }
                    />
                  </td>
                  <td className="py-4 pr-4">
                    <b>{product?.name}</b>
                    {variant && (
                      <p className="mt-1 font-semibold text-brand-700">
                        {variant.name}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      per {product?.base_unit} · {branch?.name ?? "No branch"}
                    </p>
                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {listing.listing_status.replaceAll("_", " ")}
                    </p>
                    {listing.price_effective_date && (
                      <p className="mt-1 text-xs text-slate-500">
                        Price effective{" "}
                        {new Intl.DateTimeFormat("en-GH", {
                          dateStyle: "medium",
                        }).format(
                          new Date(`${listing.price_effective_date}T00:00:00Z`),
                        )}
                      </p>
                    )}
                  </td>
                  <td colSpan={3} className="py-3 pr-4">
                    {canEdit ? (
                      <form
                        className="grid grid-cols-[140px_190px] gap-2"
                        action={async (formData) => {
                          setPending(true);
                          const result = await quickUpdateListing(
                            listing.id,
                            formData,
                          );
                          setPending(false);
                          setMessage(
                            result.error ?? `${product?.name} updated`,
                          );
                        }}
                      >
                        <input
                          aria-label={`${product?.name} price`}
                          className="input py-2"
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={listing.price ?? ""}
                          placeholder="Add price"
                        />
                        {listing.inventory_mode === "exact_quantity" ? (
                          <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                            Movement controlled
                          </div>
                        ) : (
                          <select
                            aria-label={`${product?.name} stock status`}
                            className="input py-2"
                            name="stockStatus"
                            defaultValue={listing.stock_status}
                          >
                            {stockOptions.map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="hidden"
                          name="stockStatus"
                          value={listing.stock_status}
                        />
                        <button
                          className="btn-secondary col-span-2 py-2"
                          disabled={pending}
                        >
                          Save price and availability
                        </button>
                      </form>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <span>
                          {listing.price == null
                            ? "No price"
                            : `GHS ${Number(listing.price).toFixed(2)}`}
                        </span>
                        <span>{listing.stock_quantity ?? "Not tracked"}</span>
                        <span className="capitalize">
                          {listing.stock_status.replaceAll("_", " ")}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex max-w-44 flex-wrap gap-1">
                      {completion.published ? (
                        <Badge tone="green">Published</Badge>
                      ) : completion.readyToPublish ? (
                        <Badge tone="green">Ready to publish</Badge>
                      ) : (
                        <Badge>Draft</Badge>
                      )}
                      {completion.needsPrice && (
                        <Badge tone="amber">Needs price</Badge>
                      )}
                      {completion.needsAvailability && (
                        <Badge tone="amber">Needs availability</Badge>
                      )}
                      {completion.needsBranch && (
                        <Badge tone="amber">Needs branch</Badge>
                      )}
                      {completion.needsStockConfirmation && (
                        <Badge tone="amber">Confirm availability</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    {supplierCanPublish &&
                      (completion.published ? (
                        <form
                          action={setListingActive.bind(
                            null,
                            listing.id,
                            false,
                          )}
                        >
                          <button className="font-bold text-brand-700">
                            Move to draft
                          </button>
                        </form>
                      ) : (
                        <form
                          action={setListingActive.bind(null, listing.id, true)}
                        >
                          <button
                            className="font-bold text-brand-700 disabled:text-slate-400"
                            disabled={!completion.readyToPublish}
                          >
                            Publish
                          </button>
                        </form>
                      ))}
                  </td>
                </tr>
              );
            })}
            {!listings.length && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No product listings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber";
}) {
  const styles =
    tone === "green"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "amber"
        ? "bg-amber-100 text-amber-900"
        : "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-bold ${styles}`}>
      {children}
    </span>
  );
}
