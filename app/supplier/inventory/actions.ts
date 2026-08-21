"use server";

import { revalidatePath } from "next/cache";
import { requireSupplierPermission } from "@/lib/organisations/access";

export type InventoryActionState = {
  error?: string;
  message?: string;
  receiptId?: string;
  internalReference?: string;
  resultingOnHand?: number;
  resultingAvailable?: number;
};
const uuid = (value: FormDataEntryValue | null) =>
  /^[0-9a-f-]{36}$/i.test(String(value ?? "")) ? String(value) : null;
const positive = (value: FormDataEntryValue | null) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export async function assignUnassignedListings(formData: FormData) {
  const { supabase } = await requireSupplierPermission("products.edit");
  const listingIds = formData
    .getAll("listingIds")
    .map(String)
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const branchId = uuid(formData.get("branchId"));
  if (!listingIds.length || !branchId)
    throw new Error("Select products and a destination branch");
  if (String(formData.get("confirmation") ?? "") !== "assign")
    throw new Error("Confirm the branch assignment");
  const { error } = await supabase.rpc("assign_supplier_listings_branch", {
    target_listing_ids: listingIds,
    target_branch: branchId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/supplier/inventory");
  revalidatePath("/supplier/products");
}

async function ensureListingLocation(
  supabase: Awaited<ReturnType<typeof requireSupplierPermission>>["supabase"],
  organisationId: string,
  listingId: string,
) {
  const { data: listing } = await supabase
    .from("supplier_listings")
    .select("id,branch_id")
    .eq("id", listingId)
    .eq("supplier_id", organisationId)
    .maybeSingle();
  if (!listing) return "Product listing not found";
  if (listing.branch_id) return null;

  const { data: branches, error } = await supabase
    .from("supplier_branches")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("is_active", true);
  if (error) return error.message;
  if (!branches?.length)
    return "Create or configure a branch before managing inventory";
  if (branches.length > 1)
    return "Assign this product to a branch before managing inventory";

  const { error: updateError } = await supabase
    .from("supplier_listings")
    .update({
      branch_id: branches[0].id,
      warehouse_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .eq("supplier_id", organisationId)
    .is("branch_id", null);
  return updateError?.message ?? null;
}

export async function receiveStock(
  _: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { supabase, membership } =
    await requireSupplierPermission("inventory.receive");
  const listing = uuid(formData.get("listingId")),
    quantity = positive(formData.get("quantity")),
    unitCost = positive(formData.get("unitCost"));
  if (!listing) return { error: "Choose a product." };
  if (!quantity) return { error: "Quantity must be greater than zero." };
  if (unitCost === null)
    return { error: "Unit cost must be greater than zero." };
  // A preloaded branch lets the authoritative receipt RPC validate the
  // location directly. Legacy unassigned listings retain the single-branch
  // auto-assignment path.
  if (formData.get("listingHasLocation") !== "true") {
    const locationError = await ensureListingLocation(
      supabase,
      membership.organisationId,
      listing,
    );
    if (locationError) return { error: locationError };
  }
  const receivedDate = String(formData.get("receivedDate") ?? "");
  if (!receivedDate) return { error: "Enter the truthful receipt date" };
  const requestKey = uuid(formData.get("requestKey"));
  if (!requestKey) return { error: "Refresh the form and try again." };
  const { data, error } = await supabase.rpc("inventory_receive_stock", {
    target_listing: listing,
    target_quantity: quantity,
    target_unit_cost: unitCost,
    target_vendor: String(formData.get("vendor") ?? ""),
    target_invoice: String(formData.get("invoice") ?? ""),
    target_received_date: receivedDate,
    target_notes: String(formData.get("notes") ?? ""),
    target_request_key: requestKey,
  } as never);
  if (error) return { error: error.message };
  const result = (
    data as unknown as
      | {
          receipt_id: string;
          internal_reference: string;
          resulting_on_hand: number;
          resulting_available: number;
        }[]
      | null
  )?.[0];
  if (!result)
    return {
      error: "The receipt was not returned. Please check movement history.",
    };
  revalidatePath("/supplier/inventory");
  revalidatePath(`/supplier/inventory/${listing}`);
  return {
    message: `Stock received successfully. ${quantity} units were added.`,
    receiptId: result.receipt_id,
    internalReference: result.internal_reference,
    resultingOnHand: result.resulting_on_hand,
    resultingAvailable: result.resulting_available,
  };
}

export async function setOpeningStock(
  _: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { supabase, membership } =
    await requireSupplierPermission("inventory.receive");
  const listing = uuid(formData.get("listingId")),
    quantity = positive(formData.get("quantity")),
    unitCost = positive(formData.get("unitCost")),
    requestKey = uuid(formData.get("requestKey"));
  if (!listing) return { error: "Choose a product." };
  if (!quantity)
    return { error: "Opening quantity must be greater than zero." };
  if (!unitCost) return { error: "Unit cost must be greater than zero." };
  if (!requestKey) return { error: "Refresh the form and try again." };
  if (formData.get("listingHasLocation") !== "true") {
    const locationError = await ensureListingLocation(
      supabase,
      membership.organisationId,
      listing,
    );
    if (locationError) return { error: locationError };
  }
  const asOfDate = String(formData.get("receivedDate") ?? "");
  if (!asOfDate) return { error: "Enter the opening-stock as-of date." };
  const { data, error } = await supabase.rpc("inventory_set_opening_stock", {
    target_listing: listing,
    target_quantity: quantity,
    target_unit_cost: unitCost,
    target_as_of_date: asOfDate,
    target_notes: String(formData.get("notes") ?? ""),
    target_request_key: requestKey,
  } as never);
  if (error) return { error: error.message };
  const result = (
    data as unknown as
      | {
          receipt_id: string;
          internal_reference: string;
          resulting_on_hand: number;
          resulting_available: number;
        }[]
      | null
  )?.[0];
  if (!result)
    return {
      error:
        "The opening stock entry was not returned. Please check movement history.",
    };
  revalidatePath("/supplier/inventory");
  revalidatePath(`/supplier/inventory/${listing}`);
  return {
    message: `Opening stock set successfully. ${quantity} units were added.`,
    receiptId: result.receipt_id,
    internalReference: result.internal_reference,
    resultingOnHand: result.resulting_on_hand,
    resultingAvailable: result.resulting_available,
  };
}

export async function adjustStock(
  _: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { supabase } = await requireSupplierPermission("inventory.adjust");
  const listing = uuid(formData.get("listingId")),
    quantity = positive(formData.get("quantity")),
    type = String(formData.get("movementType") ?? ""),
    reason = String(formData.get("reason") ?? "").trim();
  if (!listing || !quantity || reason.length < 5)
    return { error: "Choose a product, quantity and detailed reason" };
  const { error } = await supabase.rpc("inventory_adjust_stock", {
    target_listing: listing,
    target_type: type,
    target_quantity: quantity,
    target_reason: reason,
    target_notes: String(formData.get("notes") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath("/supplier/inventory");
  revalidatePath("/supplier/products");
  return { message: "Inventory adjustment recorded" };
}

export async function recordStockCount(
  _: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { supabase, membership } =
    await requireSupplierPermission("inventory.adjust");
  const listing = uuid(formData.get("listingId"));
  const physical = Number(formData.get("physicalQuantity"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (
    !listing ||
    !Number.isFinite(physical) ||
    physical < 0 ||
    reason.length < 5
  )
    return {
      error:
        "Choose a product, enter the physical count and provide a detailed reason",
    };
  const locationError = await ensureListingLocation(
    supabase,
    membership.organisationId,
    listing,
  );
  if (locationError) return { error: locationError };
  const { data: position, error: positionError } = await supabase.rpc(
    "inventory_listing_position",
    { target_listing: listing },
  );
  if (positionError) return { error: positionError.message };
  const current = Number(
      (position as { on_hand?: number | null } | null)?.on_hand ?? 0,
    ),
    difference = physical - current;
  if (difference === 0)
    return {
      message: "Physical count matches the ledger; no movement was required",
    };
  const { error } = await supabase.rpc("inventory_adjust_stock", {
    target_listing: listing,
    target_type: "stock_count_correction",
    target_quantity: difference,
    target_reason: reason,
    target_notes: String(formData.get("notes") ?? ""),
  });
  if (error) return { error: error.message };
  revalidatePath("/supplier/inventory");
  revalidatePath(`/supplier/inventory/${listing}`);
  revalidatePath("/supplier/products");
  return {
    message: `Stock count recorded (${difference > 0 ? "+" : ""}${difference})`,
  };
}

export async function transferStock(
  _: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { supabase } = await requireSupplierPermission("inventory.transfer");
  const source = uuid(formData.get("sourceListing")),
    destination = uuid(formData.get("destinationListing")),
    quantity = positive(formData.get("quantity")),
    reason = String(formData.get("reason") ?? "").trim();
  if (!source || !destination || !quantity || reason.length < 5)
    return { error: "Choose source, destination, quantity and reason" };
  const { error } = await supabase.rpc("inventory_transfer_stock", {
    source_listing: source,
    destination_listing: destination,
    target_quantity: quantity,
    target_reason: reason,
  });
  if (error) return { error: error.message };
  revalidatePath("/supplier/inventory");
  return { message: "Stock transfer recorded" };
}

export async function configureInventory(
  _: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { supabase, membership } = await requireSupplierPermission(
    "inventory.configure",
  );
  const listing = uuid(formData.get("listingId"));
  if (!listing) return { error: "Choose a product" };
  const locationError = await ensureListingLocation(
    supabase,
    membership.organisationId,
    listing,
  );
  if (locationError) return { error: locationError };
  const numberOrNull = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value === "" ? null : Number(value);
  };
  const { error } = await supabase.rpc("inventory_configure_listing", {
    target_listing: listing,
    target_mode: String(
      formData.get("inventoryMode") ?? "confirmation_required",
    ),
    target_show_exact: formData.get("showExact") === "on",
    target_reorder: numberOrNull("reorderPoint"),
    target_preferred_reorder: numberOrNull("preferredReorder"),
  });
  if (error) return { error: error.message };
  revalidatePath("/supplier/inventory");
  revalidatePath("/supplier/products");
  return { message: "Inventory configuration updated" };
}

export async function setStockSetupProgress(
  _: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { supabase } = await requireSupplierPermission("inventory.configure");
  const listing = uuid(formData.get("listingId"));
  const status = String(formData.get("status") ?? "");
  if (!listing || !["skipped", "completed"].includes(status))
    return { error: "Invalid stock setup progress" };
  const { error } = await supabase.rpc("inventory_set_setup_progress", {
    target_listing: listing,
    target_status: status,
  });
  if (error) return { error: error.message };
  revalidatePath("/supplier/inventory");
  return {
    message: status === "skipped" ? "Product skipped" : "Stock setup saved",
  };
}

export async function processReturn(
  _: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { supabase } = await requireSupplierPermission("inventory.adjust");
  const item = uuid(formData.get("orderItemId")),
    requestKey = uuid(formData.get("requestKey")),
    quantity = positive(formData.get("quantity")),
    disposition = String(formData.get("disposition") ?? ""),
    reason = String(formData.get("reason") ?? "").trim();
  if (!item || !requestKey || !quantity || reason.length < 5)
    return {
      error: "Choose an item, quantity, disposition and detailed reason",
    };
  const { error } = await supabase.rpc("inventory_record_return", {
    target_order_item: item,
    target_quantity: quantity,
    target_disposition: disposition,
    target_reason: reason,
    target_notes: String(formData.get("notes") ?? ""),
    target_request_key: requestKey,
  });
  if (error) return { error: error.message };
  revalidatePath("/supplier/inventory");
  revalidatePath("/supplier/products");
  return { message: "Return disposition recorded" };
}
