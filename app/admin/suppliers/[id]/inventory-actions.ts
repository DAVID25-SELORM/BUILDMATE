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

export async function importObservedSupplierInventory(supplierId: string, formData: FormData) {
  const { user } = await requirePermission({ permission: "suppliers.verify" });
  if (!uuidPattern.test(supplierId)) return { error: "Invalid supplier." };
  const rows = String(formData.get("inventory") ?? "").split(/\r?\n/).map((line) => {
    const [category, name, unit] = line.split("|").map((value) => value?.trim());
    return { category, name, unit };
  }).filter((row) => row.category && row.name && row.unit);
  if (!rows.length) return { error: "Enter inventory as Category | Product | Unit, one item per line." };
  if (rows.length > 100) return { error: "Import no more than 100 items at a time." };

  const admin = createAdminClient();
  const { data: supplier } = await admin.from("organisations").select("id,organisation_type").eq("id", supplierId).maybeSingle();
  if (!supplier || supplier.organisation_type !== "supplier") return { error: "Supplier not found." };
  const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);

  const categoryNames = [...new Set(rows.map((row) => row.category!))];
  const { error: categoryUpsertError } = await admin.from("categories").upsert(categoryNames.map((name, index) => ({ name, slug: slugify(name), is_active: true, sort_order: index + 1 })), { onConflict: "slug", ignoreDuplicates: true });
  if (categoryUpsertError) return { error: categoryUpsertError.message };
  const { data: categories, error: categoryError } = await admin.from("categories").select("id,name").in("name", categoryNames);
  if (categoryError) return { error: categoryError.message };
  const categoryIds = new Map((categories ?? []).map((category) => [category.name, category.id]));

  const productPayloads = rows.map((row) => ({
    category_id: categoryIds.get(row.category!), name: row.name!, slug: slugify(row.name!),
    description: "Observed during a verified supplier site visit; exact specification requires supplier confirmation.",
    base_unit: row.unit!, is_active: true,
  })).filter((product) => product.category_id);
  const { error: productUpsertError } = await admin.from("products").upsert(productPayloads, { onConflict: "slug", ignoreDuplicates: true });
  if (productUpsertError) return { error: productUpsertError.message };
  const { data: products, error: productError } = await admin.from("products").select("id,slug").in("slug", productPayloads.map((product) => product.slug));
  if (productError) return { error: productError.message };

  const productIds = (products ?? []).map((product) => product.id);
  const { data: existing } = await admin.from("supplier_listings").select("product_id").eq("supplier_id", supplierId).in("product_id", productIds).is("sku", null);
  const existingIds = new Set((existing ?? []).map((listing) => listing.product_id));
  const newIds = productIds.filter((id) => !existingIds.has(id));
  if (newIds.length) {
    const { error } = await admin.from("supplier_listings").insert(newIds.map((productId) => ({ supplier_id: supplierId, product_id: productId, price: null, stock_status: "confirmation_required", listing_status: "draft", is_active: false, supplier_notes: "Added from the supplier site visit; price, quantity and exact specification require supplier confirmation." })));
    if (error) return { error: error.message };
  }
  await admin.from("admin_action_history").insert({ actor_id: user.id, action: "supplier_site_inventory_imported", subject_type: "supplier", subject_id: supplierId, reason: "Inventory recorded from supplier site visit", metadata: { items: rows.map((row) => row.name), drafts_created: newIds.length } });
  revalidatePath(`/admin/suppliers/${supplierId}`); revalidatePath("/admin/catalogue"); revalidatePath("/supplier/products");
  return { success: true, count: newIds.length, products: rows.length };
}
