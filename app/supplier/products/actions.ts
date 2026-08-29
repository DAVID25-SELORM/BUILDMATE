"use server";

import { revalidatePath } from "next/cache";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { listingSchema } from "@/lib/catalogue/validation";

export type CreateProductState = {
  error?: string;
  message?: string;
  listingId?: string;
  stockReference?: string;
};

export async function createProductForSale(
  _: CreateProductState,
  formData: FormData,
): Promise<CreateProductState> {
  const { supabase, membership } =
    await requireSupplierPermission("products.create");
  const uuid = /^[0-9a-f-]{36}$/i;
  const productId = String(formData.get("productId") ?? "");
  const variantId = String(formData.get("variantId") ?? "") || null;
  const branchId = String(formData.get("branchId") ?? "");
  const price = Number(formData.get("price"));
  const quantity = Number(formData.get("quantity"));
  const unitCost = Number(formData.get("unitCost"));
  const publish = formData.get("intent") === "publish";
  if (!uuid.test(productId)) return { error: "Choose a product." };
  if (variantId && !uuid.test(variantId))
    return { error: "Choose a valid variant." };
  const location = await resolveBranch(
    supabase,
    membership.organisationId,
    branchId || null,
  );
  if (location.error || !location.branchId)
    return { error: location.error ?? "Choose a location." };
  if (!Number.isFinite(price) || price <= 0)
    return { error: "Add a selling price." };
  if (!Number.isFinite(quantity) || quantity <= 0)
    return { error: "Enter available quantity." };
  if (!Number.isFinite(unitCost) || unitCost <= 0)
    return { error: "Enter what you paid for one unit." };
  if (
    formData.get("deliveryAvailable") !== "on" &&
    formData.get("pickupAvailable") !== "on"
  )
    return { error: "Choose delivery, pickup, or both." };
  const { data, error } = await supabase.rpc(
    "supplier_create_product_for_sale" as never,
    {
      target_supplier: membership.organisationId,
      target_product: productId,
      target_variant: variantId,
      target_branch: location.branchId,
      target_price: price,
      target_quantity: quantity,
      target_unit_cost: unitCost,
      target_delivery: formData.get("deliveryAvailable") === "on",
      target_pickup: formData.get("pickupAvailable") === "on",
      target_sku: String(formData.get("sku") ?? ""),
      target_notes: String(formData.get("notes") ?? ""),
      target_publish: publish,
      target_request_key: crypto.randomUUID(),
    } as never,
  );
  if (error) {
    const duplicate = error.message.match(/\[listing:([0-9a-f-]{36})\]/i);
    return {
      error: duplicate
        ? "This product is already in your product list."
        : error.message.replace(/ \[listing:[0-9a-f-]{36}\]/i, ""),
      listingId: duplicate?.[1],
    };
  }
  const result = (
    data as unknown as
      | { listing_id: string; stock_reference: string; published: boolean }[]
      | null
  )?.[0];
  revalidatePath("/supplier/products");
  revalidatePath("/supplier/inventory");
  revalidatePath("/shop");
  return {
    message: publish
      ? "Product published. Customers can now see this offer."
      : "Draft saved with opening stock recorded.",
    listingId: result?.listing_id,
    stockReference: result?.stock_reference,
  };
}

export async function requestCatalogueProduct(
  _: CreateProductState,
  formData: FormData,
): Promise<CreateProductState> {
  const { user, supabase, membership } =
    await requireSupplierPermission("products.create");
  const name = String(formData.get("productName") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const image = formData.get("image");
  if (name.length < 2 || category.length < 2 || description.length < 5)
    return {
      error: "Enter the product name, category and a short description.",
    };
  let imagePath: string | null = null;
  if (image instanceof File && image.size > 0) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type))
      return { error: "Use a JPG, PNG or WebP image." };
    if (image.size > 5 * 1024 * 1024)
      return { error: "Product request images must be 5 MB or smaller." };
    const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    imagePath = `${membership.organisationId}/catalogue-requests/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("product-media")
      .upload(imagePath, image, { contentType: image.type, upsert: false });
    if (uploadError) return { error: uploadError.message };
  }
  const { error } = await supabase
    .from("supplier_catalogue_requests" as never)
    .insert({
      supplier_id: membership.organisationId,
      requested_by: user.id,
      product_name: name,
      category,
      description,
      image_path: imagePath,
    } as never);
  if (error) {
    if (imagePath)
      await supabase.storage.from("product-media").remove([imagePath]);
    return { error: error.message };
  }
  return { message: "Product request sent for BuildMate review." };
}

async function resolveBranch(
  supabase: Awaited<ReturnType<typeof requireSupplierPermission>>["supabase"],
  organisationId: string,
  requestedBranch: string | null,
) {
  const { data: branches, error } = await supabase
    .from("supplier_branches")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("is_active", true);
  if (error) return { error: error.message, branchId: null };
  if (!branches?.length)
    return {
      error: "Create or configure a branch before managing product inventory",
      branchId: null,
    };
  if (branches.length === 1) return { error: null, branchId: branches[0].id };
  if (!requestedBranch)
    return { error: "Choose a branch for these products", branchId: null };
  if (!branches.some((branch) => branch.id === requestedBranch))
    return {
      error: "Choose a branch belonging to this supplier",
      branchId: null,
    };
  return { error: null, branchId: requestedBranch };
}

export async function saveListing(formData: FormData) {
  const { user, supabase, membership } = await requireSupplierPermission(
    formData.get("id") ? "products.edit" : "products.create",
  );
  if (!membership || membership.organisation.verification_status !== "approved")
    return { error: "Only approved suppliers can manage listings" };
  const location = await resolveBranch(
    supabase,
    membership.organisationId,
    String(formData.get("branchId") ?? "") || null,
  );
  if (location.error) return { error: location.error };
  const parsed = listingSchema.safeParse({
    id: formData.get("id") ?? "",
    productId: formData.get("productId"),
    sku: formData.get("sku") ?? "",
    price: formData.get("price"),
    wholesalePrice: formData.get("wholesalePrice") ?? "",
    wholesaleMinimum: formData.get("wholesaleMinimum") ?? "",
    stockQuantity: formData.get("stockQuantity") ?? "",
    stockStatus: formData.get("stockStatus"),
    leadTimeDays: formData.get("leadTimeDays"),
    minimumOrderQuantity: formData.get("minimumOrderQuantity") ?? "",
    deliveryAvailable: formData.get("deliveryAvailable") === "on",
    pickupAvailable: formData.get("pickupAvailable") === "on",
    supplierNotes: formData.get("supplierNotes") ?? "",
    branchId: location.branchId ?? "",
    warehouseId: formData.get("warehouseId") ?? "",
    listingStatus: formData.get("listingStatus") ?? "draft",
    isActive: formData.get("listingStatus") === "published",
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid listing" };
  let priceMetadata = {};
  let currentInventoryMode: string | null = null;
  if (parsed.data.id) {
    const { data: current } = await supabase
      .from("supplier_listings")
      .select("price,inventory_mode")
      .eq("id", parsed.data.id)
      .eq("supplier_id", membership.organisationId)
      .maybeSingle();
    currentInventoryMode = current?.inventory_mode ?? null;
    if (
      current &&
      (current.price == null ? null : Number(current.price)) !==
        parsed.data.price
    )
      priceMetadata = {
        currency: "GHS",
        price_effective_date: new Date().toISOString().slice(0, 10),
        price_source: "supplier portal",
        price_source_reference: null,
        price_updated_by: user.id,
      };
  } else if (parsed.data.price !== null) {
    priceMetadata = {
      currency: "GHS",
      price_effective_date: new Date().toISOString().slice(0, 10),
      price_source: "supplier portal",
      price_source_reference: null,
      price_updated_by: user.id,
    };
  }
  const payload = {
    supplier_id: membership.organisationId,
    product_id: parsed.data.productId,
    sku: parsed.data.sku || null,
    price: parsed.data.price,
    wholesale_price: parsed.data.wholesalePrice,
    wholesale_minimum: parsed.data.wholesaleMinimum,
    ...(currentInventoryMode === "exact_quantity"
      ? {}
      : { stock_status: parsed.data.stockStatus }),
    lead_time_days: parsed.data.leadTimeDays,
    minimum_order_quantity: parsed.data.minimumOrderQuantity,
    delivery_available: parsed.data.deliveryAvailable,
    pickup_available: parsed.data.pickupAvailable,
    supplier_notes: parsed.data.supplierNotes || null,
    branch_id: parsed.data.branchId,
    warehouse_id: parsed.data.warehouseId,
    listing_status: parsed.data.listingStatus,
    is_active: parsed.data.listingStatus === "published",
    availability_confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...priceMetadata,
  };
  if (parsed.data.branchId) {
    const { data: branch } = await supabase
      .from("supplier_branches")
      .select("id")
      .eq("id", parsed.data.branchId)
      .eq("organisation_id", membership.organisationId)
      .maybeSingle();
    if (!branch) return { error: "Choose a branch belonging to this supplier" };
  }
  if (parsed.data.warehouseId) {
    const { data: warehouse } = await supabase
      .from("supplier_warehouses")
      .select("id,branch_id")
      .eq("id", parsed.data.warehouseId)
      .eq("organisation_id", membership.organisationId)
      .maybeSingle();
    if (!warehouse)
      return { error: "Choose a warehouse belonging to this supplier" };
    if (
      parsed.data.branchId &&
      warehouse.branch_id &&
      warehouse.branch_id !== parsed.data.branchId
    )
      return { error: "The warehouse does not belong to the selected branch" };
  }
  const query = parsed.data.id
    ? supabase
        .from("supplier_listings")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("supplier_id", membership.organisationId)
    : supabase.from("supplier_listings").insert(payload);
  const { error } = await query;
  if (error)
    return {
      error:
        error.code === "23505"
          ? "You already have a listing for this product and SKU"
          : error.message,
    };
  revalidatePath("/supplier/products");
  revalidatePath("/shop");
  return { success: true };
}

export async function setListingActive(listingId: string, isActive: boolean) {
  const { supabase, membership } =
    await requireSupplierPermission("products.publish");
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) throw new Error("Invalid listing");
  if (isActive) {
    const [{ data: listing }, { data: organisation }] = await Promise.all([
      supabase
        .from("supplier_listings")
        .select(
          "price,stock_status,stock_quantity,inventory_mode,delivery_available,pickup_available",
        )
        .eq("id", listingId)
        .eq("supplier_id", membership.organisationId)
        .maybeSingle(),
      supabase
        .from("organisations")
        .select("account_status,verification_status,product_publishing_enabled")
        .eq("id", membership.organisationId)
        .maybeSingle(),
    ]);
    if (!listing || listing.price == null || Number(listing.price) <= 0)
      throw new Error("Add a retail price before publishing");
    if (listing.stock_status === "out_of_stock")
      throw new Error("An out-of-stock listing cannot be published");
    if (!listing.delivery_available && !listing.pickup_available)
      throw new Error("Choose delivery or pickup before publishing");
    if (
      (listing.inventory_mode === "exact_quantity" &&
        Number(listing.stock_quantity ?? 0) <= 0) ||
      (listing.inventory_mode === "status_only" &&
        listing.stock_status !== "in_stock") ||
      !["exact_quantity", "status_only"].includes(listing.inventory_mode)
    )
      throw new Error("Set up available stock before publishing");
    if (
      !organisation ||
      organisation.account_status !== "active" ||
      organisation.verification_status !== "approved" ||
      !organisation.product_publishing_enabled
    )
      throw new Error("Supplier publishing is not currently enabled");
  }
  const { error } = await supabase
    .from("supplier_listings")
    .update({
      listing_status: isActive ? "published" : "draft",
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .eq("supplier_id", membership.organisationId);
  if (error) throw new Error(error.message);
  revalidatePath("/supplier/products");
  revalidatePath("/shop");
}

export async function quickUpdateListing(
  listingId: string,
  formData: FormData,
) {
  const { user, supabase, membership } =
    await requireSupplierPermission("products.edit");
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) return { error: "Invalid listing" };
  const priceValue = String(formData.get("price") ?? "").trim();
  const stockValue = String(formData.get("stockQuantity") ?? "").trim();
  const price = priceValue === "" ? null : Number(priceValue);
  const stockQuantity = stockValue === "" ? null : Number(stockValue);
  const stockStatus = String(
    formData.get("stockStatus") ?? "confirmation_required",
  );
  if (price !== null && (!Number.isFinite(price) || price < 0))
    return { error: "Enter a valid price" };
  if (
    stockQuantity !== null &&
    (!Number.isFinite(stockQuantity) || stockQuantity < 0)
  )
    return { error: "Enter a valid stock quantity" };
  if (
    ![
      "in_stock",
      "low_stock",
      "out_of_stock",
      "confirmation_required",
      "available_on_order",
    ].includes(stockStatus)
  )
    return { error: "Choose a valid stock status" };
  const { data: current } = await supabase
    .from("supplier_listings")
    .select("price,inventory_mode")
    .eq("id", listingId)
    .eq("supplier_id", membership.organisationId)
    .maybeSingle();
  if (!current) return { error: "Listing not found" };
  const priceChanged =
    (current.price == null ? null : Number(current.price)) !== price;
  const priceMetadata = priceChanged
    ? {
        currency: "GHS",
        price_effective_date: new Date().toISOString().slice(0, 10),
        price_source: "supplier portal",
        price_source_reference: null,
        price_updated_by: user.id,
      }
    : {};
  const inventoryUpdate =
    current.inventory_mode === "exact_quantity"
      ? {}
      : { stock_status: stockStatus };
  const { error } = await supabase
    .from("supplier_listings")
    .update({
      price,
      ...inventoryUpdate,
      availability_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...priceMetadata,
    })
    .eq("id", listingId)
    .eq("supplier_id", membership.organisationId);
  if (error) return { error: error.message };
  revalidatePath("/supplier/products");
  revalidatePath("/shop");
  return { success: true };
}

export async function submitPriceClarification(
  _: { error?: string; message?: string },
  formData: FormData,
) {
  const { supabase } = await requireSupplierPermission("products.edit");
  const clarificationId = String(formData.get("clarificationId") ?? "");
  const action = String(formData.get("supplierAction") ?? "");
  const productId = String(formData.get("productId") ?? "") || null;
  const variantId = String(formData.get("variantId") ?? "") || null;
  const rawPrice = String(formData.get("confirmedPrice") ?? "").trim();
  const price = rawPrice === "" ? null : Number(rawPrice);
  if (
    !/^[0-9a-f-]{36}$/i.test(clarificationId) ||
    (price !== null && (!Number.isFinite(price) || price < 0))
  )
    return { error: "Enter valid clarification details" };
  const { error } = await supabase.rpc("submit_supplier_price_clarification", {
    target_clarification: clarificationId,
    target_action: action,
    target_name: String(formData.get("confirmedName") ?? ""),
    target_specification: String(formData.get("confirmedSpecification") ?? ""),
    target_unit: String(formData.get("confirmedUnit") ?? ""),
    target_price: price,
    target_product: productId,
    target_variant: variantId,
    target_note: String(formData.get("supplierNote") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath("/supplier/products");
  revalidatePath("/admin/catalogue");
  return { message: "Clarification submitted for catalogue review" };
}

export async function bulkUpdateListings(formData: FormData) {
  const { supabase, membership } =
    await requireSupplierPermission("products.edit");
  const listingIds = [
    ...new Set(formData.getAll("listingIds").map(String)),
  ].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!listingIds.length) return { error: "Select at least one product" };
  if (listingIds.length > 100)
    return { error: "Select no more than 100 products" };
  const location = await resolveBranch(
    supabase,
    membership.organisationId,
    String(formData.get("branchId") ?? "") || null,
  );
  if (location.error) return { error: location.error };
  const branchId = location.branchId;
  const warehouseId = String(formData.get("warehouseId") ?? "") || null;
  const stockStatus = String(
    formData.get("stockStatus") ?? "confirmation_required",
  );
  const listingStatus = String(formData.get("listingStatus") ?? "draft");
  if (
    ![
      "in_stock",
      "low_stock",
      "out_of_stock",
      "confirmation_required",
      "available_on_order",
    ].includes(stockStatus)
  )
    return { error: "Choose a valid stock status" };
  if (
    ![
      "draft",
      "published",
      "out_of_stock",
      "seasonal",
      "discontinued",
    ].includes(listingStatus)
  )
    return { error: "Choose a valid listing status" };
  if (branchId) {
    const { data } = await supabase
      .from("supplier_branches")
      .select("id")
      .eq("id", branchId)
      .eq("organisation_id", membership.organisationId)
      .maybeSingle();
    if (!data) return { error: "Choose a branch belonging to this supplier" };
  }
  if (warehouseId) {
    const { data } = await supabase
      .from("supplier_warehouses")
      .select("id,branch_id")
      .eq("id", warehouseId)
      .eq("organisation_id", membership.organisationId)
      .maybeSingle();
    if (!data)
      return { error: "Choose a warehouse belonging to this supplier" };
    if (branchId && data.branch_id && data.branch_id !== branchId)
      return { error: "The warehouse does not belong to the selected branch" };
  }
  const { data: owned } = await supabase
    .from("supplier_listings")
    .select("id,price,delivery_available,pickup_available,inventory_mode")
    .eq("supplier_id", membership.organisationId)
    .in("id", listingIds);
  if ((owned ?? []).length !== listingIds.length)
    return { error: "One or more listings are unavailable" };
  if ((owned ?? []).some((item) => item.inventory_mode === "exact_quantity"))
    return {
      error:
        "Exact-quantity listings must be updated from Inventory so every stock change is recorded",
    };
  const deliveryAvailable = formData.get("deliveryAvailable") === "on";
  const pickupAvailable = formData.get("pickupAvailable") === "on";
  if (listingStatus === "published") {
    const publishContext = await requireSupplierPermission("products.publish");
    if (publishContext.membership.organisationId !== membership.organisationId)
      return { error: "Publishing permission is required" };
    if ((owned ?? []).some((item) => item.price == null))
      return {
        error: "Every selected listing needs a price before publishing",
      };
    if (stockStatus === "out_of_stock")
      return { error: "Out-of-stock listings cannot be published" };
    if (!deliveryAvailable && !pickupAvailable)
      return { error: "Choose delivery or pickup before publishing" };
  }
  const { error } = await supabase
    .from("supplier_listings")
    .update({
      branch_id: branchId,
      warehouse_id: warehouseId,
      stock_status: stockStatus,
      listing_status: listingStatus,
      is_active: listingStatus === "published",
      delivery_available: deliveryAvailable,
      pickup_available: pickupAvailable,
      availability_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("supplier_id", membership.organisationId)
    .in("id", listingIds);
  if (error) return { error: error.message };
  revalidatePath("/supplier/products");
  revalidatePath("/shop");
  return { success: true, count: listingIds.length };
}

export async function createListingDrafts(formData: FormData) {
  const { supabase, membership } =
    await requireSupplierPermission("products.create");
  const productIds = formData
    .getAll("productIds")
    .map(String)
    .filter((value) => /^[0-9a-f-]{36}$/i.test(value));
  if (!productIds.length)
    return { error: "Choose at least one catalogue product" };
  const location = await resolveBranch(
    supabase,
    membership.organisationId,
    String(formData.get("branchId") ?? "") || null,
  );
  if (location.error) return { error: location.error };
  const warehouseId = String(formData.get("warehouseId") ?? "") || null;
  if (warehouseId) {
    const { data: warehouse } = await supabase
      .from("supplier_warehouses")
      .select("id,branch_id")
      .eq("id", warehouseId)
      .eq("organisation_id", membership.organisationId)
      .maybeSingle();
    if (
      !warehouse ||
      (warehouse.branch_id && warehouse.branch_id !== location.branchId)
    )
      return { error: "Choose a warehouse at the selected branch" };
  }
  const { data, error } = await supabase.rpc(
    "create_supplier_listing_drafts_at_location",
    {
      target_supplier: membership.organisationId,
      target_product_ids: productIds,
      target_branch: location.branchId,
      target_warehouse: warehouseId,
    },
  );
  if (error) return { error: error.message };
  revalidatePath("/supplier/products");
  return { success: true, count: Number(data ?? 0) };
}
