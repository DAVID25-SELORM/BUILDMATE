"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createSupplierInventoryDrafts(supplierId: string, formData: FormData) {
  const { user } = await requirePermission({ permission: "suppliers.verify" });
  if (!uuidPattern.test(supplierId)) return { error: "Invalid supplier." };

  const productIds = [...new Set(formData.getAll("productIds").map(String))]
    .filter((id) => uuidPattern.test(id));
  if (!productIds.length) return { error: "Choose at least one catalogue product." };
  if (productIds.length > 100) return { error: "Choose no more than 100 products at a time." };

  const admin = createAdminClient();
  const [{ data: supplier }, { data: products, error: productError }] = await Promise.all([
    admin.from("organisations").select("id,name,organisation_type").eq("id", supplierId).maybeSingle(),
    admin.from("products").select("id").in("id", productIds).eq("is_active", true),
  ]);
  if (!supplier || supplier.organisation_type !== "supplier") return { error: "Supplier not found." };
  if (productError) return { error: productError.message };

  const validProductIds = (products ?? []).map((product) => product.id);
  const { data: existing, error: existingError } = await admin
    .from("supplier_listings")
    .select("product_id")
    .eq("supplier_id", supplierId)
    .in("product_id", validProductIds)
    .is("sku", null);
  if (existingError) return { error: existingError.message };
  const existingIds = new Set((existing ?? []).map((listing) => listing.product_id));
  const newProductIds = validProductIds.filter((id) => !existingIds.has(id));

  if (newProductIds.length) {
    const { error } = await admin.from("supplier_listings").insert(newProductIds.map((productId) => ({
      supplier_id: supplierId,
      product_id: productId,
      price: null,
      stock_status: "confirmation_required",
      listing_status: "draft",
      is_active: false,
      supplier_notes: "Added from the supplier site visit; price, quantity and exact specification require supplier confirmation.",
    })));
    if (error) return { error: error.message };
  }

  await admin.from("admin_action_history").insert({
    actor_id: user.id,
    action: "supplier_inventory_drafts_created",
    subject_type: "supplier",
    subject_id: supplierId,
    reason: "Inventory recorded from supplier site visit",
    metadata: { requested: productIds.length, created: newProductIds.length, product_ids: newProductIds },
  });

  revalidatePath(`/admin/suppliers/${supplierId}`);
  revalidatePath("/supplier/products");
  return { success: true, count: newProductIds.length, existing: validProductIds.length - newProductIds.length };
}
