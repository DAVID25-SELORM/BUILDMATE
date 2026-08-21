import { redirect } from "next/navigation";
import { ProductMediaManager } from "@/components/commerce/ProductMediaManager";
import { CataloguePicker } from "@/components/supplier/products/CataloguePicker";
import { ListingForm } from "@/components/supplier/products/ListingForm";
import {
  SupplierInventoryEditor,
  type InventoryListing,
} from "@/components/supplier/products/SupplierInventoryEditor";
import { ClarificationQueue } from "@/components/supplier/products/ClarificationQueue";
import { SupplierPageHeader } from "@/components/supplier/SupplierPageHeader";
import { requireSupplierPermission } from "@/lib/organisations/access";

type ListingRow = {
  id: string;
  products:
    | { name: string; base_unit: string }
    | { name: string; base_unit: string }[]
    | null;
  product_media?: {
    id: string;
    storage_path: string;
    alt_text: string;
    is_cover: boolean;
    sort_order: number;
  }[];
};

export default async function SupplierProductsPage() {
  const { supabase, membership } =
    await requireSupplierPermission("products.view");
  if (membership.organisation.verification_status !== "approved")
    redirect("/supplier");
  const [
    { data: products },
    { data: listings },
    { data: branches },
    { data: warehouses },
    { data: organisation },
    { data: clarifications },
    { data: canEdit },
    { data: canCreate },
    { data: canPublish },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,base_unit,categories(name),brands(name)")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("supplier_listings")
      .select(
        "id,product_id,product_variant_id,sku,price,currency,price_effective_date,updated_at,wholesale_price,wholesale_minimum,stock_quantity,stock_status,inventory_mode,lead_time_days,minimum_order_quantity,delivery_available,pickup_available,supplier_notes,listing_status,is_active,branch_id,warehouse_id,products(name,base_unit),product_variants(name,specifications),supplier_branches(name),product_media(id,storage_path,alt_text,is_cover,sort_order)",
      )
      .eq("supplier_id", membership.organisationId)
      .order("created_at", { ascending: false }),
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
    supabase
      .from("organisations")
      .select("account_status,verification_status,product_publishing_enabled")
      .eq("id", membership.organisationId)
      .maybeSingle(),
    supabase
      .from("supplier_price_clarifications")
      .select(
        "id,raw_description,raw_price_text,notes,review_status,confirmed_product_name,confirmed_specification,confirmed_sales_unit,confirmed_price,supplier_action,supplier_note,mapped_product_id,mapped_variant_id",
      )
      .eq("supplier_id", membership.organisationId)
      .eq("status", "requires_confirmation")
      .order("created_at"),
    supabase.rpc("has_permission", {
      target_permission: "products.edit",
      target_organisation: membership.organisationId,
    }),
    supabase.rpc("has_permission", {
      target_permission: "products.create",
      target_organisation: membership.organisationId,
    }),
    supabase.rpc("has_permission", {
      target_permission: "products.publish",
      target_organisation: membership.organisationId,
    }),
  ]);
  const mediaListings = ((listings ?? []) as unknown as ListingRow[]).map(
    (listing) => {
      const product = Array.isArray(listing.products)
        ? listing.products[0]
        : listing.products;
      return {
        id: listing.id,
        name: product?.name ?? "Product listing",
        media: (listing.product_media ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => ({
            id: item.id,
            url: supabase.storage
              .from("product-media")
              .getPublicUrl(item.storage_path).data.publicUrl,
            altText: item.alt_text,
            isCover: item.is_cover,
          })),
      };
    },
  );
  const catalogue = (products ?? []).map((product) => ({
    id: product.id,
    name: product.name,
    base_unit: product.base_unit,
    category:
      (product.categories as unknown as { name: string } | null)?.name ??
      "Uncategorised",
    brand: (product.brands as unknown as { name: string } | null)?.name ?? null,
  }));
  const inventoryListings = (listings ?? []) as unknown as InventoryListing[];
  const supplierCanPublish =
    canPublish === true &&
    organisation?.account_status === "active" &&
    organisation?.verification_status === "approved" &&
    organisation?.product_publishing_enabled === true;
  return (
    <>
      <div>
        <SupplierPageHeader title="Products" description="Complete prices and stock, assign fulfilment, then publish verified offers." />
        {branches?.length === 1 && (
          <p className="mt-2 text-sm font-semibold text-brand-800">
            Location: {branches[0].name}
            {branches[0].is_main_branch ? " · Main Branch" : ""}
            {!warehouses?.length ? " · No warehouse" : ""}
          </p>
        )}
      </div>
      {!supplierCanPublish && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Publishing is unavailable until the supplier account is active,
          approved and enabled for product publishing. Draft editing remains
          available.
        </div>
      )}
      <div className="mt-6">
        <SupplierInventoryEditor
          listings={inventoryListings}
          branches={branches ?? []}
          warehouses={warehouses ?? []}
          canEdit={canEdit === true}
          supplierCanPublish={supplierCanPublish}
        />
      </div>
      {!!clarifications?.length && (
        <ClarificationQueue items={clarifications} products={catalogue} />
      )}
      {canEdit === true && (
        <details className="card mt-6 p-5">
          <summary className="cursor-pointer text-lg font-bold text-brand-800">
            Advanced listing details
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            Edit SKU, wholesale terms, minimum order, lead time, notes and
            individual fulfilment settings.
          </p>
          <div className="mt-5 space-y-4">
            {inventoryListings.map((listing) => (
              <ListingForm
                key={listing.id}
                products={catalogue}
                branches={branches ?? []}
                warehouses={warehouses ?? []}
                initial={{
                  id: listing.id,
                  productId: listing.product_id,
                  sku: listing.sku,
                  price: listing.price,
                  wholesalePrice: listing.wholesale_price,
                  wholesaleMinimum: listing.wholesale_minimum,
                  stockQuantity: listing.stock_quantity,
                  stockStatus: listing.stock_status,
                  inventoryMode: listing.inventory_mode,
                  leadTimeDays: listing.lead_time_days,
                  minimumOrderQuantity: listing.minimum_order_quantity,
                  deliveryAvailable: listing.delivery_available,
                  pickupAvailable: listing.pickup_available,
                  supplierNotes: listing.supplier_notes,
                  listingStatus: listing.listing_status,
                  branchId: listing.branch_id,
                  warehouseId: listing.warehouse_id,
                }}
              />
            ))}
          </div>
        </details>
      )}
      {canCreate === true && (
        <details className="mt-6" id="add-product" open={inventoryListings.length === 0}>
          <summary className="cursor-pointer font-bold text-brand-800">
            + Add Product from BuildMate catalogue
          </summary>
          <div className="mt-3">
            <CataloguePicker
              products={catalogue}
              branches={branches ?? []}
              warehouses={warehouses ?? []}
            />
          </div>
        </details>
      )}
      {canEdit === true && <ProductMediaManager listings={mediaListings} />}
    </>
  );
}
