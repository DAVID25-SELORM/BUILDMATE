import Image from "next/image";
import Link from "next/link";
import { MapPin, PackageCheck, Star, Truck } from "lucide-react";
import { AddToCartButton } from "./AddToCartButton";

export type Product = {
  listingId?: string;
  productId?: string;
  supplierCount?: number;
  offerCount?: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  supplier: string;
  location?: string;
  locations?: string[];
  variants?: string[];
  variant?: string | null;
  availabilityLabel?: string;
  deliveryAvailable?: boolean;
  pickupAvailable?: boolean;
  rating?: number;
  imageUrl?: string;
  imageAlt?: string;
};
function fallback(name: string) {
  const value = name.toLowerCase();
  if (value.includes("steel") || value.includes("rod"))
    return "steel-reinforcement.webp";
  if (value.includes("roof")) return "roofing-installation.webp";
  if (value.includes("tile")) return "tiles-flooring.webp";
  if (value.includes("paint")) return "paint-finishes.webp";
  if (value.includes("block")) return "blocks-and-bricks.webp";
  return "cement-and-concrete.webp";
}

export function ProductCard({ product }: { product: Product }) {
  const locations = product.locations?.length
    ? product.locations
    : product.location
      ? [product.location]
      : [];
  const offerCount = product.offerCount ?? product.supplierCount ?? 0;
  return (
    <article className="card flex h-full flex-col overflow-hidden">
      <div className="relative h-44">
        <Image
          src={
            product.imageUrl ?? `/images/categories/${fallback(product.name)}`
          }
          alt={product.imageAlt ?? `${product.name} building material`}
          fill
          sizes="(max-width:768px) 100vw,25vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          {product.category}
        </p>
        <h3 className="mt-2 text-lg font-bold">{product.name}</h3>
        {!!product.variants?.length && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">
            {product.variants.join(" · ")}
          </p>
        )}
        <p className="mt-3 text-2xl font-bold">
          {product.supplierCount ? "From " : ""}GHS {product.price.toFixed(2)}{" "}
          <span className="text-sm font-normal text-slate-500">
            /{product.unit}
          </span>
        </p>
        <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
          <span>{product.supplier}</span>
          {product.rating != null && (
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-current" /> {product.rating}
            </span>
          )}
        </div>
        {!!locations.length && (
          <p className="mt-2 flex items-start gap-1 text-xs text-slate-500">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {locations.slice(0, 2).join(" · ")}
          </p>
        )}
        {product.availabilityLabel && (
          <p className="mt-3 flex items-start gap-1.5 text-sm font-semibold text-amber-800">
            <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {product.availabilityLabel}
          </p>
        )}
        {(product.deliveryAvailable || product.pickupAvailable) && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
            <Truck className="h-3.5 w-3.5" />
            {[
              product.deliveryAvailable && "Delivery",
              product.pickupAvailable && "Pickup",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <div className="mt-auto pt-5">
          {product.listingId ? (
            <AddToCartButton
              item={{
                listingId: product.listingId,
                productId: product.productId,
                variant: product.variant ?? product.variants?.[0] ?? null,
                name: product.name,
                supplier: product.supplier,
                unit: product.unit,
                price: product.price,
                availabilityLabel: product.availabilityLabel,
                deliveryAvailable: product.deliveryAvailable,
                pickupAvailable: product.pickupAvailable,
              }}
            />
          ) : (
            <Link
              href={
                product.productId
                  ? `/shop/${product.productId}`
                  : `/shop?q=${encodeURIComponent(product.name)}`
              }
              className="btn-primary block w-full py-2.5 text-center"
            >
              {product.productId
                ? offerCount > 1
                  ? `Compare ${offerCount} offers`
                  : "View offer"
                : "Find suppliers"}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
