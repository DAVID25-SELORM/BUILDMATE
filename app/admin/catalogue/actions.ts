"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { productSchema } from "@/lib/catalogue/validation";

export async function saveProduct(formData: FormData) {
  await requireRole(["admin", "super_admin"]);
  const parsed = productSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    brandId: formData.get("brandId") ?? "",
    description: formData.get("description") ?? "",
    baseUnit: formData.get("baseUnit"),
    isActive: formData.get("isActive") === "on"
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid product" };

  const supabase = await createClient();
  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    category_id: parsed.data.categoryId,
    brand_id: parsed.data.brandId,
    description: parsed.data.description || null,
    base_unit: parsed.data.baseUnit,
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString()
  };
  const query = parsed.data.id
    ? supabase.from("products").update(payload).eq("id", parsed.data.id)
    : supabase.from("products").insert(payload);
  const { error } = await query;
  if (error) return { error: error.message };
  revalidatePath("/admin/catalogue");
  revalidatePath("/shop");
  return { success: true };
}

export async function setProductActive(productId: string, isActive: boolean) {
  await requireRole(["admin", "super_admin"]);
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", productId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/catalogue");
  revalidatePath("/shop");
}
