"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSupplierMembership } from "@/lib/supplier/data";
import { listingSchema } from "@/lib/catalogue/validation";

export async function saveListing(formData: FormData) {
  const { user } = await requireRole(["supplier"]);
  const supabase = await createClient();
  const membership = await getSupplierMembership(supabase, user.id);
  if (!membership || membership.organisation.verification_status !== "approved") return { error: "Only approved suppliers can manage listings" };
  const parsed = listingSchema.safeParse({
    id: formData.get("id") ?? "", productId: formData.get("productId"), sku: formData.get("sku") ?? "",
    price: formData.get("price"), wholesalePrice: formData.get("wholesalePrice") ?? "",
    wholesaleMinimum: formData.get("wholesaleMinimum") ?? "", stockQuantity: formData.get("stockQuantity") ?? "",
    stockStatus: formData.get("stockStatus"), leadTimeDays: formData.get("leadTimeDays"), isActive: formData.get("isActive") === "on"
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid listing" };
  const payload = {
    supplier_id: membership.organisationId, product_id: parsed.data.productId, sku: parsed.data.sku || null,
    price: parsed.data.price, wholesale_price: parsed.data.wholesalePrice, wholesale_minimum: parsed.data.wholesaleMinimum,
    stock_quantity: parsed.data.stockQuantity, stock_status: parsed.data.stockStatus, lead_time_days: parsed.data.leadTimeDays,
    is_active: parsed.data.isActive, updated_at: new Date().toISOString()
  };
  const query = parsed.data.id ? supabase.from("supplier_listings").update(payload).eq("id", parsed.data.id) : supabase.from("supplier_listings").insert(payload);
  const { error } = await query;
  if (error) return { error: error.code === "23505" ? "You already have a listing for this product and SKU" : error.message };
  revalidatePath("/supplier/products"); revalidatePath("/shop");
  return { success: true };
}

export async function setListingActive(listingId: string, isActive: boolean) {
  await requireRole(["supplier"]);
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_listings").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", listingId);
  if (error) throw new Error(error.message);
  revalidatePath("/supplier/products"); revalidatePath("/shop");
}
