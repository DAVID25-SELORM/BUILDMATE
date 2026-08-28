import Link from "next/link";
import { InventoryOperationForms } from "@/components/supplier/inventory/InventoryOperationForms";
import { ReturnProcessing } from "@/components/supplier/inventory/ReturnProcessing";
import { SupplierPageHeader } from "@/components/supplier/SupplierPageHeader";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { assignUnassignedListings } from "@/app/supplier/inventory/actions";
import { OpenInventoryOperationButton } from "@/components/supplier/inventory/OpenInventoryOperationButton";
import { marketplaceVisibility } from "@/lib/catalogue/listing-completion";

type Row = {
  listing_id: string;
  product: string;
  variant: string | null;
  sku: string | null;
  category: string | null;
  brand: string | null;
  branch: string | null;
  warehouse: string | null;
  inventory_mode: string;
  on_hand: number | null;
  reserved: number | null;
  available: number | null;
  sold: number | null;
  damaged: number | null;
  average_cost: number | null;
  selling_price: number | null;
  cost_value: number | null;
  selling_value: number | null;
  stock_status: string;
  reorder_point: number | null;
  last_movement_at: string | null;
  updated_at: string;
  sales_velocity: number;
};
type Dashboard = {
  can_view_cost: boolean;
  summary: {
    total_skus: number;
    on_hand: number;
    available: number;
    reserved: number;
    cost_value: number | null;
    retail_value: number;
    potential_margin: number | null;
    low_stock: number;
    out_of_stock: number;
    confirmation_required: number;
  };
  rows: Row[];
};

const money = (value: number | null) =>
  value == null ? "Restricted" : `GHS ${Number(value).toFixed(2)}`;
const values = (rows: Row[], key: keyof Row) =>
  [
    ...new Set(rows.map((row) => String(row[key] ?? "")).filter(Boolean)),
  ].sort();

export default async function SupplierInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const { supabase, membership } =
    await requireSupplierPermission("inventory.view");
  const [
    { data },
    { data: listings },
    { data: organisation },
    { data: returns },
    { data: branches },
    { data: warehouses },
    { data: receive },
    { data: adjust },
    { data: transfer },
    { data: configure },
    { data: setupProgress },
  ] = await Promise.all([
    supabase.rpc("inventory_dashboard", {
      target_organisation: membership.organisationId,
    }),
    supabase
      .from("supplier_listings")
      .select(
        "id,product_id,product_variant_id,price,stock_quantity,stock_status,inventory_mode,listing_status,is_active,branch_id,delivery_available,pickup_available,products(name,base_unit),product_variants(name),supplier_branches(name,is_main_branch),supplier_warehouses(name),product_media(storage_path,is_cover,sort_order)",
      )
      .eq("supplier_id", membership.organisationId)
      .order("created_at"),
    supabase
      .from("organisations")
      .select("account_status,verification_status,product_publishing_enabled")
      .eq("id", membership.organisationId)
      .maybeSingle(),
    supabase.rpc("inventory_return_queue", {
      target_organisation: membership.organisationId,
    }),
    supabase
      .from("supplier_branches")
      .select("id,name,is_main_branch")
      .eq("organisation_id", membership.organisationId)
      .eq("is_active", true)
      .order("is_main_branch", { ascending: false }),
    supabase
      .from("supplier_warehouses")
      .select("id,name,branch_id")
      .eq("organisation_id", membership.organisationId)
      .eq("is_active", true)
      .order("name"),
    ...[
      "inventory.receive",
      "inventory.adjust",
      "inventory.transfer",
      "inventory.configure",
    ].map((target_permission) =>
      supabase.rpc("has_permission", {
        target_permission,
        target_organisation: membership.organisationId,
      }),
    ),
    supabase.rpc("inventory_get_setup_progress", {
      target_organisation: membership.organisationId,
    }),
  ]);
  const dashboard = (data ?? {
    can_view_cost: false,
    summary: {},
    rows: [],
  }) as Dashboard;
  const supplierCanPublish = Boolean(
    organisation?.account_status === "active" &&
      organisation?.verification_status === "approved" &&
      organisation?.product_publishing_enabled,
  );
  const s = dashboard.summary;
  const search = (q.search ?? "").toLowerCase();
  let rows = dashboard.rows.filter(
    (row) =>
      (!search ||
        `${row.product} ${row.sku ?? ""}`.toLowerCase().includes(search)) &&
      (!q.category || row.category === q.category) &&
      (!q.brand || row.brand === q.brand) &&
      (!q.branch || row.branch === q.branch) &&
      (!q.warehouse || row.warehouse === q.warehouse) &&
      (!q.mode || row.inventory_mode === q.mode) &&
      (!q.status || row.stock_status === q.status) &&
      (!q.updated || row.updated_at?.slice(0, 10) >= q.updated),
  );
  const direction = q.direction === "desc" ? -1 : 1;
  const sort = q.sort ?? "product";
  rows = rows.sort(
    (a, b) =>
      direction *
      (sort === "product"
        ? a.product.localeCompare(b.product)
        : Number(a[sort as keyof Row] ?? 0) -
          Number(b[sort as keyof Row] ?? 0)),
  );
  const listingLabels = new Map(
    (listings ?? []).map((listing) => {
      const product = listing.products as unknown as { name: string } | null;
      const variant = listing.product_variants as unknown as {
        name: string;
      } | null;
      const branch = listing.supplier_branches as unknown as {
        name: string;
        is_main_branch: boolean;
      } | null;
      const warehouse = listing.supplier_warehouses as unknown as {
        name: string;
      } | null;
      const media = (
        listing.product_media as unknown as
          | { storage_path: string; is_cover: boolean; sort_order: number }[]
          | null
      )?.sort(
        (a, b) =>
          Number(b.is_cover) - Number(a.is_cover) ||
          a.sort_order - b.sort_order,
      )[0];
      return [
        listing.id,
        {
          label: `${product?.name ?? "Product"}${variant ? ` — ${variant.name}` : ""} · ${branch?.name ?? "Unassigned"}${warehouse ? ` / ${warehouse.name}` : ""}`,
          imageUrl: media
            ? supabase.storage
                .from("product-media")
                .getPublicUrl(media.storage_path).data.publicUrl
            : null,
          listingStatus: listing.listing_status,
          branchName: branch?.name ?? null,
          branchIsMain: branch?.is_main_branch ?? false,
          marketplace: listing.is_active
            ? marketplaceVisibility(
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
              )
            : listing.listing_status === "published"
              ? "Hidden — Inactive"
              : "Hidden — Draft",
        },
      ] as const;
    }),
  );
  const listingRecords = new Map(
    (listings ?? []).map((listing) => [listing.id, listing] as const),
  );
  const options = dashboard.rows.map((row) => ({
    id: row.listing_id,
    productId: listingRecords.get(row.listing_id)?.product_id ?? "",
    variantId:
      listingRecords.get(row.listing_id)?.product_variant_id ?? null,
    label: listingLabels.get(row.listing_id)?.label ?? row.product,
    imageUrl: listingLabels.get(row.listing_id)?.imageUrl ?? null,
    product: row.product,
    variant: row.variant,
    price: row.selling_price,
    onHand: row.on_hand,
    reserved: row.reserved,
    available: row.available,
    averageCost: row.average_cost,
    inventoryMode: row.inventory_mode,
    reorderPoint: row.reorder_point,
    branch: listingLabels.get(row.listing_id)?.branchName ?? row.branch,
    branchIsMain:
      listingLabels.get(row.listing_id)?.branchIsMain ?? false,
    marketplace:
      listingLabels.get(row.listing_id)?.marketplace ?? "Hidden",
    listingStatus:
      listingLabels.get(row.listing_id)?.listingStatus ?? "draft",
    unit:
      (listingRecords.get(row.listing_id)?.products as unknown as {
        base_unit?: string;
      } | null)?.base_unit ?? null,
  }));
  const singleBranch = branches?.length === 1 ? branches[0] : null;
  const hasTrackedInventory = dashboard.rows.some((row) => row.on_hand != null);
  const cards = [
    [
      "Stock cost value",
      hasTrackedInventory ? money(s.cost_value) : "Not available",
    ],
    [
      "Potential sales value",
      hasTrackedInventory ? money(s.retail_value) : "Not available",
    ],
    [
      "Potential gross margin",
      hasTrackedInventory ? money(s.potential_margin) : "Not available",
    ],
    ["Available units", hasTrackedInventory ? s.available : "Not tracked"],
    ["Total products", s.total_skus],
    ["On hand", hasTrackedInventory ? s.on_hand : "Not tracked"],
    ["Reserved", hasTrackedInventory ? s.reserved : "Not tracked"],
    ["Low stock", s.low_stock],
    ["Out of stock", s.out_of_stock],
    ["Needs stock setup", s.confirmation_required],
  ];
  const recent = dashboard.rows
    .filter((row) => row.last_movement_at)
    .sort((a, b) =>
      String(b.last_movement_at).localeCompare(String(a.last_movement_at)),
    )
    .slice(0, 5);

  return (
    <>
      <SupplierPageHeader
        title={`Inventory${singleBranch ? ` · ${singleBranch.name}` : ""}`}
        description={
          singleBranch
            ? `All inventory is currently held at ${singleBranch.name}. Track stock, valuation and movements from one workspace.`
            : "Track stock, valuation and movements across your branches."
        }
      />
      {!branches?.length && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          Inventory operations need a branch.{" "}
          <Link className="font-bold underline" href="/supplier/settings">
            Create or configure a branch
          </Link>{" "}
          to continue.
        </div>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => {
          const filter =
            label === "Low stock"
              ? "low_stock"
              : label === "Out of stock"
                ? "out_of_stock"
                : label === "Needs stock setup"
                  ? "confirmation_required"
                  : null;
          const body = (
            <>
              <p className="text-xs font-bold uppercase text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-2xl font-black">{value ?? 0}</p>
            </>
          );
          return filter ? (
            <Link
              className="card p-4 transition hover:border-brand-300 hover:shadow-md"
              href={`/supplier/inventory?${label === "Needs stock setup" ? "mode" : "status"}=${filter}`}
              key={label}
            >
              {body}
            </Link>
          ) : (
            <div className="card p-4" key={label}>
              {body}
            </div>
          );
        })}
      </div>
      {(listings ?? []).some((listing) => !listing.branch_id) && (
        <form action={assignUnassignedListings} className="card mt-5 p-5">
          <h2 className="text-lg font-bold">
            Products needing branch assignment
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Assigning a branch changes location only. It does not create or
            change stock quantities.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(listings ?? [])
              .filter((listing) => !listing.branch_id)
              .map((listing) => {
                const product = listing.products as unknown as {
                  name: string;
                } | null;
                return (
                  <label
                    className="rounded-xl border p-3 text-sm"
                    key={listing.id}
                  >
                    <input
                      className="mr-2"
                      type="checkbox"
                      name="listingIds"
                      value={listing.id}
                    />
                    {product?.name ?? "Product"}
                  </label>
                );
              })}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <select className="input" name="branchId" required>
              <option value="">Choose destination branch</option>
              {branches?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="confirmation"
                value="assign"
                required
              />{" "}
              Confirm branch assignment
            </label>
            <button className="btn-primary">Assign selected</button>
          </div>
        </form>
      )}
      <InventoryOperationForms
        listings={options}
        canReceive={receive === true}
        canAdjust={adjust === true}
        canTransfer={transfer === true}
        canConfigure={configure === true}
        canViewCost={dashboard.can_view_cost}
        branchName={singleBranch?.name}
        branchCount={branches?.length ?? 0}
        warehouseCount={warehouses?.length ?? 0}
        setupProgress={
          (
            setupProgress as {
              items?: {
                listing_id: string;
                status: string;
                updated_at: string;
              }[];
            } | null
          )?.items ?? []
        }
        setupLastSavedAt={
          (setupProgress as { last_saved_at?: string | null } | null)
            ?.last_saved_at ?? null
        }
      />
      <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
        <Link
          className={
            !q.status && !q.mode
              ? "rounded-full bg-brand-700 px-4 py-2 text-white"
              : "rounded-full bg-slate-100 px-4 py-2"
          }
          href="/supplier/inventory"
        >
          All
        </Link>
        <Link
          className="rounded-full bg-slate-100 px-4 py-2"
          href="/supplier/inventory?status=in_stock"
        >
          In Stock
        </Link>
        <Link
          className="rounded-full bg-slate-100 px-4 py-2"
          href="/supplier/inventory?status=low_stock"
        >
          Low Stock
        </Link>
        <Link
          className="rounded-full bg-slate-100 px-4 py-2"
          href="/supplier/inventory?status=out_of_stock"
        >
          Out of Stock
        </Link>
        <Link
          className="rounded-full bg-amber-100 px-4 py-2 text-amber-950"
          href="/supplier/inventory?mode=confirmation_required"
        >
          Needs Stock Setup
        </Link>
      </div>
      <form className="card mt-6 grid gap-3 p-4 md:grid-cols-4 xl:grid-cols-6">
        <input
          className="input"
          name="search"
          defaultValue={q.search}
          placeholder="Product or SKU"
        />
        <Select
          name="category"
          label="Category"
          current={q.category}
          options={values(dashboard.rows, "category")}
        />
        <Select
          name="brand"
          label="Brand"
          current={q.brand}
          options={values(dashboard.rows, "brand")}
        />
        {(branches?.length ?? 0) > 1 && (
          <Select
            name="branch"
            label="Branch"
            current={q.branch}
            options={values(dashboard.rows, "branch")}
          />
        )}
        {(warehouses?.length ?? 0) > 0 && (
          <Select
            name="warehouse"
            label="Warehouse"
            current={q.warehouse}
            options={values(dashboard.rows, "warehouse")}
          />
        )}
        <Select
          name="mode"
          label="Inventory mode"
          current={q.mode}
          options={values(dashboard.rows, "inventory_mode")}
        />
        <Select
          name="status"
          label="Stock status"
          current={q.status}
          options={values(dashboard.rows, "stock_status")}
        />
        <label>
          <span className="label">Updated since</span>
          <input
            className="input"
            type="date"
            name="updated"
            defaultValue={q.updated}
          />
        </label>
        <Select
          name="sort"
          label="Sort"
          current={sort}
          options={[
            "product",
            "available",
            "cost_value",
            "selling_value",
            "last_movement_at",
            "sales_velocity",
          ]}
        />
        <Select
          name="direction"
          label="Direction"
          current={q.direction ?? "asc"}
          options={["asc", "desc"]}
        />
        <button className="btn-primary self-end">Apply filters</button>
        <Link
          className="btn-secondary self-end text-center"
          href="/supplier/inventory"
        >
          Clear
        </Link>
      </form>
      <section className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Product</th>
              <th>Variant / SKU</th>
              <th>Location</th>
              <th>On hand</th>
              <th>Reserved</th>
              <th>Available</th>
              <th>Average cost</th>
              <th>Selling price</th>
              <th>Stock value</th>
              <th>Status</th>
              <th>Marketplace</th>
              <th>Last movement</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className="border-b last:border-0"
                key={`${row.listing_id}-${row.branch}-${row.warehouse}`}
              >
                <td className="p-4 font-bold">{row.product}</td>
                <td>
                  {row.variant ?? "Standard"}
                  <p className="text-xs text-slate-500">
                    {row.sku ?? "No SKU"}
                  </p>
                </td>
                <td>
                  {row.branch ?? "Unassigned"}
                  {row.warehouse ? ` / ${row.warehouse}` : ""}
                </td>
                <td>{row.on_hand ?? "—"}</td>
                <td>{row.reserved ?? "—"}</td>
                <td className="font-bold">{row.available ?? "—"}</td>
                <td>{money(row.average_cost)}</td>
                <td>{money(row.selling_price)}</td>
                <td>{money(row.cost_value)}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${row.inventory_mode === "confirmation_required" ? "bg-amber-100 text-amber-900" : row.stock_status === "out_of_stock" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}
                  >
                    {row.inventory_mode === "confirmation_required"
                      ? "Needs stock setup"
                      : row.stock_status.replaceAll("_", " ")}
                  </span>
                </td>
                <td>
                  <span
                    className={`text-xs font-bold ${listingLabels.get(row.listing_id)?.marketplace === "Visible" ? "text-emerald-700" : "text-amber-700"}`}
                  >
                    {listingLabels.get(row.listing_id)?.marketplace ?? "Hidden"}
                  </span>
                </td>
                <td>
                  {row.last_movement_at
                    ? new Date(row.last_movement_at).toLocaleDateString("en-GH")
                    : "None"}
                </td>
                <td>
                  <OpenInventoryOperationButton
                    className="mb-2 inline-flex min-h-10 items-center rounded-xl bg-emerald-800 px-3 text-xs font-bold text-white hover:bg-emerald-900"
                    operation={row.on_hand == null ? "setup" : "receive"}
                    listingId={row.listing_id}
                  >
                    {row.on_hand == null ? "Set Up Stock" : "+ Add Stock"}
                  </OpenInventoryOperationButton>
                  <details className="relative">
                    <summary className="cursor-pointer font-bold text-brand-700">
                      Actions
                    </summary>
                    <div className="absolute right-0 z-10 mt-2 w-48 rounded-xl border bg-white p-2 shadow-xl">
                      <Link
                        className="block rounded-lg px-3 py-2 hover:bg-slate-50"
                        href={`/supplier/inventory/${row.listing_id}`}
                      >
                        View inventory
                      </Link>
                      <Link
                        className="block rounded-lg px-3 py-2 hover:bg-slate-50"
                        href={`/supplier/products#listing-${row.listing_id}`}
                      >
                        Edit price
                      </Link>
                      <Link
                        className="block rounded-lg px-3 py-2 hover:bg-slate-50"
                        href={`/supplier/inventory/${row.listing_id}#movements`}
                      >
                        Movement history
                      </Link>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={13} className="p-8 text-center text-slate-500">
                  No inventory matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Needs Attention</h2>
            <Link
              className="text-sm font-bold text-brand-700"
              href="/supplier/inventory/reports"
            >
              View reports →
            </Link>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <Link
                href="/supplier/inventory?mode=confirmation_required"
                className="flex justify-between rounded-xl bg-amber-50 p-3"
              >
                <span>Products needing stock setup</span>
                <b>{s.confirmation_required}</b>
              </Link>
            </li>
            <li>
              <Link
                href="/supplier/inventory?status=low_stock"
                className="flex justify-between rounded-xl bg-slate-50 p-3"
              >
                <span>Below reorder level</span>
                <b>{s.low_stock}</b>
              </Link>
            </li>
            <li>
              <span className="flex justify-between rounded-xl bg-slate-50 p-3">
                <span>Reserved units awaiting fulfilment</span>
                <b>{s.reserved}</b>
              </span>
            </li>
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="text-xl font-black">Recent inventory activity</h2>
          <div className="mt-4 space-y-3">
            {recent.map((row) => (
              <Link
                href={`/supplier/inventory/${row.listing_id}#movements`}
                className="block rounded-xl bg-slate-50 p-3"
                key={row.listing_id}
              >
                <b>
                  {row.product}
                  {row.variant ? ` — ${row.variant}` : ""}
                </b>
                <p className="text-xs text-slate-500">
                  Last movement{" "}
                  {new Date(row.last_movement_at!).toLocaleString("en-GH")}
                </p>
              </Link>
            ))}
            {!recent.length && (
              <p className="text-sm text-slate-500">
                No inventory movements have been recorded yet.
              </p>
            )}
          </div>
        </section>
      </div>
      <ReturnProcessing items={(returns ?? []) as never[]} />
    </>
  );
}

function Select({
  name,
  label,
  current,
  options,
}: {
  name: string;
  label: string;
  current?: string;
  options: string[];
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="input" name={name} defaultValue={current ?? ""}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
