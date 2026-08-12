"use server";

import { revalidatePath } from "next/cache";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { listingSchema } from "@/lib/catalogue/validation";

export async function saveListing(formData: FormData) {
  const { supabase,membership } = await requireSupplierPermission(formData.get("id") ? "products.edit" : "products.create");
  if (!membership || membership.organisation.verification_status !== "approved") return { error: "Only approved suppliers can manage listings" };
  const parsed = listingSchema.safeParse({
    id: formData.get("id") ?? "", productId: formData.get("productId"), sku: formData.get("sku") ?? "",
    price: formData.get("price"), wholesalePrice: formData.get("wholesalePrice") ?? "",
    wholesaleMinimum: formData.get("wholesaleMinimum") ?? "", stockQuantity: formData.get("stockQuantity") ?? "",
    stockStatus: formData.get("stockStatus"), leadTimeDays: formData.get("leadTimeDays"),
    minimumOrderQuantity: formData.get("minimumOrderQuantity") ?? "",
    deliveryAvailable: formData.get("deliveryAvailable") === "on",
    pickupAvailable: formData.get("pickupAvailable") === "on",
    supplierNotes: formData.get("supplierNotes") ?? "",
    listingStatus: formData.get("listingStatus") ?? "draft",
    isActive: formData.get("listingStatus") === "published"
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid listing" };
  const payload = {
    supplier_id: membership.organisationId, product_id: parsed.data.productId, sku: parsed.data.sku || null,
    price: parsed.data.price, wholesale_price: parsed.data.wholesalePrice, wholesale_minimum: parsed.data.wholesaleMinimum,
    stock_quantity: parsed.data.stockQuantity, stock_status: parsed.data.stockStatus, lead_time_days: parsed.data.leadTimeDays,
    minimum_order_quantity: parsed.data.minimumOrderQuantity,
    delivery_available: parsed.data.deliveryAvailable, pickup_available: parsed.data.pickupAvailable,
    supplier_notes: parsed.data.supplierNotes || null, listing_status: parsed.data.listingStatus,
    is_active: parsed.data.listingStatus === "published", availability_confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString()
  };
  const query = parsed.data.id ? supabase.from("supplier_listings").update(payload).eq("id", parsed.data.id) : supabase.from("supplier_listings").insert(payload);
  const { error } = await query;
  if (error) return { error: error.code === "23505" ? "You already have a listing for this product and SKU" : error.message };
  revalidatePath("/supplier/products"); revalidatePath("/shop");
  return { success: true };
}

export async function setListingActive(listingId: string, isActive: boolean) {
  const {supabase,membership}=await requireSupplierPermission("products.publish");
  const { error } = await supabase.from("supplier_listings").update({ listing_status: isActive ? "published" : "draft", is_active: isActive, updated_at: new Date().toISOString() }).eq("id", listingId).eq("supplier_id",membership.organisationId);
  if (error) throw new Error(error.message);
  revalidatePath("/supplier/products"); revalidatePath("/shop");
}

export async function createListingDrafts(formData: FormData) {
  const { supabase, membership } = await requireSupplierPermission("products.create");
  const productIds = formData.getAll("productIds").map(String).filter((value) => /^[0-9a-f-]{36}$/i.test(value));
  if (!productIds.length) return { error: "Choose at least one catalogue product" };
  const { data, error } = await supabase.rpc("create_supplier_listing_drafts", {
    target_supplier: membership.organisationId,
    target_product_ids: productIds,
  });
  if (error) return { error: error.message };
  revalidatePath("/supplier/products");
  return { success: true, count: Number(data ?? 0) };
}
