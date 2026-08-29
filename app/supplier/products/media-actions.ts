"use server";

import { revalidatePath } from "next/cache";
import { requireSupplierPermission } from "@/lib/organisations/access";

export type MediaState = { ok?: boolean; message: string };

export async function recordProductImage(
  listingId: string,
  input: { storagePath: string; altText: string },
): Promise<MediaState> {
  const { supabase, membership } =
    await requireSupplierPermission("products.edit");
  const altText = input.altText.trim();
  if (!/^[0-9a-f-]{36}$/i.test(listingId))
    return { message: "Invalid product listing." };
  if (altText.length < 5 || altText.length > 240)
    return { message: "Describe the image in 5–240 characters." };

  const { data: listing } = await supabase
    .from("supplier_listings")
    .select("id")
    .eq("id", listingId)
    .eq("supplier_id", membership.organisationId)
    .maybeSingle();
  if (!listing) return { message: "Listing not found or unavailable." };

  const expectedPrefix = `${membership.organisationId}/${listingId}/`;
  if (
    !input.storagePath.startsWith(expectedPrefix) ||
    input.storagePath.length > expectedPrefix.length + 180 ||
    input.storagePath.includes("..")
  )
    return { message: "Invalid product image path." };

  const fileName = input.storagePath.slice(expectedPrefix.length);
  const { data: stored, error: storageLookupError } = await supabase.storage
    .from("product-media")
    .list(expectedPrefix.slice(0, -1), { search: fileName, limit: 1 });
  if (storageLookupError || !stored?.some((item) => item.name === fileName))
    return {
      message: "The uploaded image could not be verified. Please try again.",
    };

  const { data: media } = await supabase
    .from("product_media")
    .select("id,sort_order")
    .eq("listing_id", listingId)
    .order("sort_order");
  if ((media?.length ?? 0) >= 8)
    return {
      message: "This listing already has the maximum of 8 images.",
    };

  const order = media?.length ?? 0;
  const { error } = await supabase.from("product_media").insert({
    listing_id: listingId,
    storage_path: input.storagePath,
    alt_text: altText,
    sort_order: order,
    is_cover: order === 0,
  });
  if (error) return { message: error.message };

  revalidatePath("/supplier/products");
  revalidatePath("/shop");
  return { ok: true, message: "Product image added." };
}

export async function deleteProductImage(mediaId: string) {
  const { supabase, membership } =
    await requireSupplierPermission("products.edit");
  const { data } = await supabase
    .from("product_media")
    .select(
      "id,storage_path,listing_id,is_cover,supplier_listings!inner(supplier_id)",
    )
    .eq("id", mediaId)
    .eq("supplier_listings.supplier_id", membership.organisationId)
    .maybeSingle();
  if (!data) return;
  await supabase.storage.from("product-media").remove([data.storage_path]);
  await supabase.from("product_media").delete().eq("id", mediaId);
  const { data: remaining } = await supabase
    .from("product_media")
    .select("id")
    .eq("listing_id", data.listing_id)
    .order("sort_order")
    .limit(1)
    .maybeSingle();
  if (data.is_cover && remaining)
    await supabase
      .from("product_media")
      .update({ is_cover: true })
      .eq("id", remaining.id);
  revalidatePath("/supplier/products");
  revalidatePath("/shop");
}

export async function setProductCover(mediaId: string, listingId: string) {
  const { supabase, membership } =
    await requireSupplierPermission("products.edit");
  const { data: listing } = await supabase
    .from("supplier_listings")
    .select("id")
    .eq("id", listingId)
    .eq("supplier_id", membership.organisationId)
    .maybeSingle();
  if (!listing) return;
  const { data: target } = await supabase
    .from("product_media")
    .select("id")
    .eq("id", mediaId)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!target) return;
  await supabase
    .from("product_media")
    .update({ is_cover: false })
    .eq("listing_id", listingId);
  await supabase
    .from("product_media")
    .update({ is_cover: true })
    .eq("id", mediaId);
  revalidatePath("/supplier/products");
  revalidatePath("/shop");
}
