"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  bulkUpdateListings,
  setListingActive,
} from "@/app/supplier/products/actions";
import {
  listingCompletion,
  listingSummary,
  marketplaceVisibility,
  supplierMarketplaceStatus,
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
    | { name: string; base_unit: string; categories?: { name: string } | null }
    | {
        name: string;
        base_unit: string;
        categories?: { name: string } | null;
      }[]
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
          stockQuantity: listing.stock_quantity,
          inventoryMode: listing.inventory_mode,
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
    ["Live", summary.published],
    [
      "Needs attention",
      summary.ready + summary.priceMissing + summary.stockConfirmation,
    ],
    ["Out of stock", summary.outOfStock],
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
        <details className="card mt-6 p-5" open={selected.length > 0}>
          <summary className="flex cursor-pointer items-center justify-between font-bold">
            <span>Bulk actions</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-800">
              {selected.length} selected
            </span>
          </summary>
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
            <p className="text-sm text-slate-600 md:col-span-3">
              Select products, then assign fulfilment and lifecycle settings
              together.
            </p>
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
        </details>
      )}
      <section className="mt-6 grid gap-3 md:hidden" id="product-list">
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
          const status = supplierMarketplaceStatus(
            {
              price: listing.price,
              stockStatus: listing.stock_status,
              stockQuantity: listing.stock_quantity,
              inventoryMode: listing.inventory_mode,
              deliveryAvailable: listing.delivery_available,
              pickupAvailable: listing.pickup_available,
              branchId: listing.branch_id,
              listingStatus: listing.listing_status,
            },
            supplierCanPublish,
          );
          const visibility = marketplaceVisibility(
            {
              price: listing.price,
              stockStatus: listing.stock_status,
              stockQuantity: listing.stock_quantity,
              inventoryMode: listing.inventory_mode,
              deliveryAvailable: listing.delivery_available,
              pickupAvailable: listing.pickup_available,
              branchId: listing.branch_id,
              listingStatus: listing.listing_status,
            },
            supplierCanPublish,
          );
          return (
            <article
              className="card p-5"
              id={`listing-${listing.id}`}
              key={listing.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black">{product?.name}</h3>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {product?.categories?.name ?? "Uncategorised"}
                  </p>
                  <p className="text-sm font-semibold text-brand-700">
                    {variant?.name ?? "Standard"} ·{" "}
                    {branch?.name ?? "No branch"}
                  </p>
                </div>
                <Badge
                  tone={
                    status === "Live"
                      ? "green"
                      : status.startsWith("Needs") || status === "Out of Stock"
                        ? "amber"
                        : "slate"
                  }
                >
                  {status}
                </Badge>
              </div>
              <p className="mt-3 text-lg font-black">
                {listing.price == null
                  ? "Price needed"
                  : `GHS ${Number(listing.price).toFixed(2)} / ${product?.base_unit}`}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {listing.stock_quantity ?? 0} available
              </p>
              <p className="mt-1 text-sm font-semibold">
                Marketplace: {visibility === "Visible" ? "Visible" : "Hidden"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  className="btn-secondary py-2"
                  href="#advanced-listing-details"
                >
                  Edit
                </a>
                <Link
                  className="btn-secondary py-2"
                  href={`/supplier/inventory?listing=${listing.id}`}
                >
                  Add Stock
                </Link>
                {status === "Live" && (
                  <Link
                    className="btn-secondary py-2"
                    href={`/shop?listing=${listing.id}`}
                  >
                    View in Shop
                  </Link>
                )}
              </div>
            </article>
          );
        })}
        {!listings.length && (
          <div className="card p-6 text-center text-slate-500">
            No products yet. Add your first product below.
          </div>
        )}
      </section>
      <section
        className="card mt-6 hidden max-h-[calc(100vh-12rem)] min-w-0 overflow-auto overscroll-contain md:block"
        id="product-list-desktop"
      >
        <table className="w-full min-w-[1050px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-30 bg-white shadow-sm">
            <tr>
              <th className="sticky left-0 z-40 border-b bg-white p-4">
                <input
                  aria-label="Select all products"
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(
                      allSelected ? [] : listings.map((listing) => listing.id),
                    )
                  }
                />{" "}
                <span className="ml-2">Product</span>
              </th>
              <th className="border-b p-4">Variant</th>
              <th className="border-b p-4">Category</th>
              <th className="border-b p-4">Price</th>
              <th className="border-b p-4">Available stock</th>
              <th className="border-b p-4">Status</th>
              <th className="border-b p-4">Marketplace status</th>
              <th className="sticky right-0 z-40 border-b bg-white p-4">
                Actions
              </th>
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
                  stockQuantity: listing.stock_quantity,
                  inventoryMode: listing.inventory_mode,
                  deliveryAvailable: listing.delivery_available,
                  pickupAvailable: listing.pickup_available,
                  branchId: listing.branch_id,
                  listingStatus: listing.listing_status,
                },
                supplierCanPublish,
              );
              const status = supplierMarketplaceStatus(
                {
                  price: listing.price,
                  stockStatus: listing.stock_status,
                  stockQuantity: listing.stock_quantity,
                  inventoryMode: listing.inventory_mode,
                  deliveryAvailable: listing.delivery_available,
                  pickupAvailable: listing.pickup_available,
                  branchId: listing.branch_id,
                  listingStatus: listing.listing_status,
                },
                supplierCanPublish,
              );
              const visibility = marketplaceVisibility(
                {
                  price: listing.price,
                  stockStatus: listing.stock_status,
                  stockQuantity: listing.stock_quantity,
                  inventoryMode: listing.inventory_mode,
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
                  id={`listing-${listing.id}`}
                  key={listing.id}
                >
                  <td className="sticky left-0 z-10 border-b bg-white p-4">
                    <label className="flex items-start gap-3">
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
                      <span>
                        <b>{product?.name}</b>
                        <small className="mt-1 block text-slate-500">
                          {branch?.name ?? "No branch"} ·{" "}
                          {listing.sku ?? "No SKU"}
                        </small>
                      </span>
                    </label>
                  </td>
                  <td className="border-b p-4 font-semibold text-brand-700">
                    {variant?.name ?? "Standard"}
                  </td>
                  <td className="border-b p-4 text-slate-600">
                    {product?.categories?.name ?? "Uncategorised"}
                  </td>
                  <td className="border-b p-4 font-bold">
                    {listing.price == null
                      ? "Needs price"
                      : `GHS ${Number(listing.price).toFixed(2)} / ${product?.base_unit}`}
                  </td>
                  <td className="border-b p-4">
                    {listing.inventory_mode === "exact_quantity"
                      ? (listing.stock_quantity ?? 0)
                      : listing.stock_status === "in_stock"
                        ? "Available"
                        : "Needs stock setup"}
                  </td>
                  <td className="border-b p-4">
                    <Badge
                      tone={
                        status === "Live"
                          ? "green"
                          : status.startsWith("Needs") ||
                              status === "Out of Stock"
                            ? "amber"
                            : "slate"
                      }
                    >
                      {status}
                    </Badge>
                  </td>
                  <td className="border-b p-4 font-semibold">
                    {visibility === "Visible" ? (
                      <Badge tone="green">Visible</Badge>
                    ) : (
                      <Badge tone="amber">Hidden</Badge>
                    )}
                  </td>
                  <td className="sticky right-0 z-10 border-b bg-white p-4">
                    <details className="relative">
                      <summary className="cursor-pointer rounded-lg border px-3 py-2 font-bold text-brand-700">
                        Manage
                      </summary>
                      <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border bg-white p-2 shadow-xl">
                        <a
                          className="block rounded-lg px-3 py-2 hover:bg-slate-50"
                          href={`#advanced-listing-${listing.id}`}
                        >
                          Edit details
                        </a>
                        <a
                          className="block rounded-lg px-3 py-2 hover:bg-slate-50"
                          href="#product-galleries"
                        >
                          Manage images
                        </a>
                        <Link
                          className="block rounded-lg px-3 py-2 hover:bg-slate-50"
                          href={`/supplier/inventory?listing=${listing.id}`}
                        >
                          Add stock
                        </Link>
                        {supplierCanPublish &&
                          (completion.published ? (
                            <form
                              action={setListingActive.bind(
                                null,
                                listing.id,
                                false,
                              )}
                            >
                              <button className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50">
                                Pause selling
                              </button>
                            </form>
                          ) : (
                            <form
                              action={setListingActive.bind(
                                null,
                                listing.id,
                                true,
                              )}
                            >
                              <button
                                className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:text-slate-400"
                                disabled={!completion.readyToPublish}
                              >
                                {completion.needsPrice
                                  ? "Add price"
                                  : completion.needsAvailability
                                    ? "Add stock"
                                    : "Publish"}
                              </button>
                            </form>
                          ))}
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
            {!listings.length && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
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
