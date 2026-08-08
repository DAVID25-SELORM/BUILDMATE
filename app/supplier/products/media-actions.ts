"use server";

import { revalidatePath } from "next/cache";
import { requireSupplierPermission } from "@/lib/organisations/access";

export type MediaState = { ok?: boolean; message: string };
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadProductImage(_: MediaState, formData: FormData): Promise<MediaState> {
  const { supabase, membership } = await requireSupplierPermission("products.edit");
  const listingId = String(formData.get("listingId") ?? "");
  const altText = String(formData.get("altText") ?? "").trim();
  const file = formData.get("image");
  if (!(file instanceof File) || !file.size) return { message: "Choose a product image." };
  if (!imageTypes.has(file.type)) return { message: "Use a JPG, PNG or WebP image." };
  if (file.size > 5 * 1024 * 1024) return { message: "Product images must be 5 MB or smaller." };
  if (altText.length < 5 || altText.length > 240) return { message: "Describe the image in 5–240 characters." };
  const { data: listing } = await supabase.from("supplier_listings").select("id").eq("id", listingId).eq("supplier_id", membership.organisationId).maybeSingle();
  if (!listing) return { message: "Listing not found or unavailable." };
  const { data: media } = await supabase.from("product_media").select("id,sort_order").eq("listing_id", listingId).order("sort_order");
  if ((media?.length ?? 0) >= 8) return { message: "This listing already has the maximum of 8 images." };
  const order = media?.length ?? 0;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
  const path = `${membership.organisationId}/${listingId}/${crypto.randomUUID()}-${safeName}`;
  const { error: storageError } = await supabase.storage.from("product-media").upload(path, file, { contentType: file.type, upsert: false });
  if (storageError) return { message: storageError.message };
  const { error } = await supabase.from("product_media").insert({ listing_id: listingId, storage_path: path, alt_text: altText, sort_order: order, is_cover: order === 0 });
  if (error) { await supabase.storage.from("product-media").remove([path]); return { message: error.message }; }
  revalidatePath("/supplier/products");
  return { ok: true, message: "Product image added." };
}

export async function deleteProductImage(mediaId: string) {
  const { supabase, membership } = await requireSupplierPermission("products.edit");
  const { data } = await supabase.from("product_media").select("id,storage_path,listing_id,is_cover,supplier_listings!inner(supplier_id)").eq("id", mediaId).eq("supplier_listings.supplier_id", membership.organisationId).maybeSingle();
  if (!data) return;
  await supabase.storage.from("product-media").remove([data.storage_path]);
  await supabase.from("product_media").delete().eq("id", mediaId);
  const { data: remaining } = await supabase.from("product_media").select("id").eq("listing_id", data.listing_id).order("sort_order").limit(1).maybeSingle();
  if (data.is_cover && remaining) await supabase.from("product_media").update({ is_cover: true }).eq("id", remaining.id);
  revalidatePath("/supplier/products");
}

export async function setProductCover(mediaId: string, listingId: string) {
  const { supabase, membership } = await requireSupplierPermission("products.edit");
  const { data: listing } = await supabase.from("supplier_listings").select("id").eq("id", listingId).eq("supplier_id", membership.organisationId).maybeSingle();
  if (!listing) return;
  const { data: target } = await supabase.from("product_media").select("id").eq("id", mediaId).eq("listing_id", listingId).maybeSingle();
  if (!target) return;
  await supabase.from("product_media").update({ is_cover: false }).eq("listing_id", listingId);
  await supabase.from("product_media").update({ is_cover: true }).eq("id", mediaId);
  revalidatePath("/supplier/products");
}
