import Link from "next/link";
import { CategoryMedia } from "@/components/commerce/CategoryMedia";
import { ProductCard } from "@/components/commerce/ProductCard";
import { matchesDeliveryCoverage } from "@/lib/delivery/coverage";
import { createClient } from "@/lib/supabase/server";

type Coverage = {
  regions_served: string[];
  cities_served: string[];
  minimum_order_value: number | null;
};
type Media = {
  storage_path: string;
  alt_text: string;
  is_cover: boolean;
  sort_order: number;
};
type Listing = {
  id: string;
  product_id: string;
  product_variant_id: string | null;
  supplier_id: string;
  price: number | string | null;
  price_effective_date: string | null;
  price_valid_until: string | null;
  lead_time_days: number;
  stock_status: string;
  inventory_mode: string;
  delivery_available: boolean;
  pickup_available: boolean;
  product_media: Media[] | null;
  product_variants: { name: string; is_active: boolean } | null;
  supplier_branches: { name: string; city: string; region: string } | null;
  products: {
    id: string;
    name: string;
    base_unit: string;
    images: string[];
    is_active: boolean;
    categories: { name: string; slug: string } | null;
  };
  organisations: {
    name: string;
    verification_status: string;
    account_status: string | null;
    supplier_delivery_coverage: Coverage | Coverage[] | null;
  };
};

function hrefFor(filters: {
  q?: string;
  category?: string;
  location?: string;
  sort?: string;
  maxPrice?: string;
  availability?: string;
}) {
  const params = new URLSearchParams(
    Object.entries(filters)
      .filter(([, value]) => value)
      .map(([key, value]) => [key, value!]),
  );
  return params.size ? `/shop?${params}` : "/shop";
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    location?: string;
    sort?: string;
    maxPrice?: string;
    availability?: string;
  }>;
}) {
  const {
    q = "",
    category = "",
    location = "",
    sort = "best",
    maxPrice = "",
    availability = "",
  } = await searchParams;
  const search = q.trim();
  const supabase = await createClient();
  const categoryResult = await supabase
    .from("categories")
    .select("id,parent_id,name,slug,image_path,image_alt,description")
    .eq("is_active", true)
    .order("sort_order");
  const categoryRows = categoryResult.data ?? [];
  const topLevelCategories = categoryRows.filter(
    (item) => item.parent_id == null,
  );
  const selectedCategoryIds: string[] = [];
  if (category) {
    const pending = categoryRows
      .filter((item) => item.slug === category)
      .map((item) => item.id);
    while (pending.length) {
      const current = pending.shift()!;
      if (selectedCategoryIds.includes(current)) continue;
      selectedCategoryIds.push(current);
      pending.push(
        ...categoryRows
          .filter((item) => item.parent_id === current)
          .map((item) => item.id),
      );
    }
  }
  const searchResult = search
    ? await supabase.rpc("public_marketplace_search_listing_ids", {
        target_query: search,
      })
    : { data: null, error: null };
  let query = supabase
    .from("supplier_listings")
    .select(
      "id,product_id,product_variant_id,supplier_id,price,price_effective_date,price_valid_until,lead_time_days,stock_quantity,stock_status,inventory_mode,delivery_available,pickup_available,product_media(storage_path,alt_text,is_cover,sort_order),product_variants(name,is_active),supplier_branches(name,city,region),products!inner(id,category_id,name,base_unit,images,is_active,categories(name,slug)),organisations!supplier_listings_supplier_id_fkey!inner(name,verification_status,account_status,supplier_delivery_coverage(regions_served,cities_served,minimum_order_value))",
    )
    .eq("listing_status", "published")
    .eq("is_active", true)
    .eq("products.is_active", true)
    .eq("organisations.verification_status", "approved")
    .eq("organisations.account_status", "active")
    .not("branch_id", "is", null)
    .or("and(inventory_mode.eq.exact_quantity,stock_quantity.gt.0),and(inventory_mode.eq.status_only,stock_status.eq.in_stock)")
    .order("price");
  if (search) query = query.in("id", (searchResult.data ?? []) as string[]);
  if (category)
    query = query.in(
      "products.category_id",
      selectedCategoryIds.length
        ? selectedCategoryIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  const listingResult = await query;
  if (searchResult.error || listingResult.error)
    throw new Error("Marketplace catalogue is temporarily unavailable.");

  const today = new Date().toISOString().slice(0, 10);
  const eligible = ((listingResult.data ?? []) as unknown as Listing[]).filter(
    (listing) =>
      listing.price != null &&
      Number(listing.price) >= 0 &&
      (!listing.price_effective_date ||
        listing.price_effective_date <= today) &&
      (!listing.price_valid_until || listing.price_valid_until >= today) &&
      (!listing.product_variant_id ||
        listing.product_variants?.is_active === true),
  );
  const maximum = maxPrice ? Number(maxPrice) : null;
  const filteredBeforeLocation = eligible.filter(
    (listing) =>
      (maximum === null ||
        (Number.isFinite(maximum) && Number(listing.price) <= maximum)) &&
      (!availability ||
        (availability === "confirmation" &&
          (listing.inventory_mode === "confirmation_required" ||
            listing.stock_status === "confirmation_required")) ||
        (availability === "delivery" && listing.delivery_available) ||
        (availability === "pickup" && listing.pickup_available)),
  );
  const locationMatches = filteredBeforeLocation.filter((listing) => {
    const raw = listing.organisations.supplier_delivery_coverage;
    return matchesDeliveryCoverage(
      location,
      Number.POSITIVE_INFINITY,
      Array.isArray(raw) ? (raw[0] ?? null) : raw,
    );
  });

  type Group = {
    productId: string;
    name: string;
    category: string;
    unit: string;
    lowestPrice: number;
    supplierIds: Set<string>;
    variants: Set<string>;
    locations: Set<string>;
    delivery: boolean;
    pickup: boolean;
    confirmationRequired: boolean;
    offerCount: number;
    fastestLeadTime: number;
    imageUrl?: string;
    imageAlt?: string;
  };
  const grouped = new Map<string, Group>();
  for (const listing of locationMatches) {
    const media = [...(listing.product_media ?? [])].sort(
      (a, b) =>
        Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order,
    )[0];
    const mediaUrl = media
      ? supabase.storage.from("product-media").getPublicUrl(media.storage_path)
          .data.publicUrl
      : listing.products.images?.[0];
    const branch = listing.supplier_branches;
    const place = branch
      ? [branch.name, branch.city].filter(Boolean).join(", ")
      : undefined;
    const existing = grouped.get(listing.product_id);
    if (existing) {
      existing.supplierIds.add(listing.supplier_id);
      existing.lowestPrice = Math.min(
        existing.lowestPrice,
        Number(listing.price),
      );
      existing.offerCount += 1;
      existing.fastestLeadTime = Math.min(
        existing.fastestLeadTime,
        listing.lead_time_days,
      );
      if (listing.product_variants?.name)
        existing.variants.add(listing.product_variants.name);
      if (place) existing.locations.add(place);
      existing.delivery ||= listing.delivery_available;
      existing.pickup ||= listing.pickup_available;
      existing.confirmationRequired ||=
        listing.inventory_mode === "confirmation_required" ||
        listing.stock_status === "confirmation_required";
      if (!existing.imageUrl && mediaUrl) {
        existing.imageUrl = mediaUrl;
        existing.imageAlt = media?.alt_text;
      }
    } else {
      grouped.set(listing.product_id, {
        productId: listing.product_id,
        name: listing.products.name,
        category: listing.products.categories?.name ?? "Materials",
        unit: listing.products.base_unit,
        lowestPrice: Number(listing.price),
        supplierIds: new Set([listing.supplier_id]),
        variants: new Set(
          listing.product_variants?.name ? [listing.product_variants.name] : [],
        ),
        locations: new Set(place ? [place] : []),
        delivery: listing.delivery_available,
        pickup: listing.pickup_available,
        confirmationRequired:
          listing.inventory_mode === "confirmation_required" ||
          listing.stock_status === "confirmation_required",
        offerCount: 1,
        fastestLeadTime: listing.lead_time_days,
        imageUrl: mediaUrl,
        imageAlt: media?.alt_text,
      });
    }
  }
  const cards = [...grouped.values()]
    .map((product) => ({
      ...product,
      supplierCount: product.supplierIds.size,
      variants: [...product.variants],
      locations: [...product.locations],
    }))
    .sort((a, b) =>
      sort === "price"
        ? a.lowestPrice - b.lowestPrice
        : sort === "fastest"
          ? a.fastestLeadTime - b.fastestLeadTime
          : b.supplierCount - a.supplierCount || a.lowestPrice - b.lowestPrice,
    );
  const hasFilters = Boolean(
    search || category || location || maxPrice || availability,
  );

  return (
    <section className="container-shell py-8 sm:py-12">
      <p className="font-semibold text-brand-700">MASTER CATALOGUE</p>
      <h1 className="mt-2 text-3xl font-black sm:text-4xl">
        Shop building materials
      </h1>
      <p className="mt-3 text-slate-600">
        Browse verified building materials from approved suppliers across Ghana.
      </p>
      <section id="categories" className="mt-8 scroll-mt-24">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-semibold text-brand-700">SHOP BY CATEGORY</p>
            <h2 className="mt-1 text-2xl font-black">Browse the full catalogue</h2>
          </div>
          {category && (
            <Link href="/shop#categories" className="text-sm font-semibold text-brand-700">
              View all categories
            </Link>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {topLevelCategories.map((item) => (
            <Link
              className={`card group overflow-hidden transition hover:border-brand-300 ${category === item.slug ? "ring-2 ring-brand-600" : ""}`}
              href={`/shop?category=${encodeURIComponent(item.slug)}#materials`}
              key={item.id}
            >
              <div className="relative aspect-[3/2]">
                <CategoryMedia
                  imagePath={item.image_path}
                  imageAlt={item.image_alt}
                  categoryName={item.name}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              </div>
              <span className="block p-3 text-sm font-bold">{item.name}</span>
            </Link>
          ))}
        </div>
      </section>
      <form
        className="mt-6 grid grid-cols-[1fr_auto] gap-3 rounded-2xl border bg-white p-4 lg:grid-cols-[2fr_1fr_auto]"
        aria-label="Marketplace filters"
      >
        <label className="col-span-2 lg:col-span-1">
          <span className="sr-only">Search materials</span>
          <input
            className="input"
            name="q"
            defaultValue={q}
            placeholder="Search materials, brands or specifications"
          />
        </label>
        <label>
          <span className="sr-only">Category</span>
          <select className="input" name="category" defaultValue={category}>
            <option value="">All categories</option>
            {topLevelCategories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
              ))}
          </select>
        </label>
        <button className="btn-primary">Search</button>
        <details
          className="col-span-2 rounded-xl bg-slate-50 p-3 lg:col-span-3"
          open={Boolean(
            location || maxPrice || availability || sort !== "best",
          )}
        >
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">
            More filters
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className="label">Delivery location</span>
              <input
                className="input"
                name="location"
                defaultValue={location}
                placeholder="City or region"
              />
            </label>
            <label>
              <span className="label">Maximum price</span>
              <input
                className="input"
                name="maxPrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={maxPrice}
                placeholder="GHS"
              />
            </label>
            <label>
              <span className="label">Availability</span>
              <select
                className="input"
                name="availability"
                defaultValue={availability}
              >
                <option value="">Any availability</option>
                <option value="confirmation">Confirm with supplier</option>
                <option value="delivery">Delivery available</option>
                <option value="pickup">Pickup available</option>
              </select>
            </label>
            <label>
              <span className="label">Sort</span>
              <select className="input" name="sort" defaultValue={sort}>
                <option value="best">Best value</option>
                <option value="price">Lowest price</option>
                <option value="fastest">Fastest delivery</option>
              </select>
            </label>
          </div>
        </details>
      </form>
      <div id="materials" className="mt-8 scroll-mt-24 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">
            {hasFilters ? "Matching materials" : "Available materials"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {cards.length} master product{cards.length === 1 ? "" : "s"}{" "}
            available
          </p>
        </div>
        {hasFilters && (
          <Link href="/shop" className="btn-secondary">
            Clear filters
          </Link>
        )}
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((product) => (
          <ProductCard
            key={product.productId}
            product={{
              name: product.name,
              category: product.category,
              price: product.lowestPrice,
              unit: product.unit,
              supplier: `${product.supplierCount} verified supplier${product.supplierCount === 1 ? "" : "s"}`,
              productId: product.productId,
              supplierCount: product.supplierCount,
              offerCount: product.offerCount,
              variants: product.variants,
              locations: product.locations,
              availabilityLabel: product.confirmationRequired
                ? "Confirm availability with supplier"
                : "Available from verified suppliers",
              deliveryAvailable: product.delivery,
              pickupAvailable: product.pickup,
              imageUrl: product.imageUrl,
              imageAlt: product.imageAlt,
            }}
          />
        ))}
      </div>
      {cards.length === 0 && !hasFilters && (
        <div className="card mt-6 p-10 text-center">
          <h3 className="text-lg font-bold">
            No building materials are currently available.
          </h3>
          <p className="mt-2 text-slate-600">
            Published offers from approved suppliers will appear here.
          </p>
        </div>
      )}
      {cards.length === 0 && search && eligible.length === 0 && (
        <div className="card mt-6 p-10 text-center">
          <h3 className="text-lg font-bold">
            We couldn&apos;t find materials matching &ldquo;{search}&rdquo;.
          </h3>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              className="btn-secondary"
              href={hrefFor({
                category,
                location,
                sort,
                maxPrice,
                availability,
              })}
            >
              Clear search
            </Link>
            <Link className="btn-primary" href="/shop">
              Browse all materials
            </Link>
          </div>
        </div>
      )}
      {cards.length === 0 && location && eligible.length > 0 && (
        <div className="card mt-6 p-10 text-center">
          <h3 className="text-lg font-bold">
            No supplier currently delivers these materials to {location}.
          </h3>
          <p className="mt-2 text-slate-600">
            Pickup may still be available from the supplier location.
          </p>
          <Link
            className="btn-primary mt-4 inline-block"
            href={hrefFor({
              q: search,
              category,
              sort,
              maxPrice,
              availability,
            })}
          >
            View pickup options
          </Link>
        </div>
      )}
      {cards.length === 0 &&
        hasFilters &&
        !(search && eligible.length === 0) &&
        !(location && eligible.length > 0) && (
          <div className="card mt-6 p-10 text-center">
            <h3 className="text-lg font-bold">
              No materials match the selected filters.
            </h3>
            <Link className="btn-primary mt-4 inline-block" href="/shop">
              Clear filters
            </Link>
          </div>
        )}
    </section>
  );
}
