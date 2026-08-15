"use server";

import { revalidatePath } from "next/cache";
import { requireSupplierPermission } from "@/lib/organisations/access";

export type InventoryActionState = { error?: string; message?: string };
const uuid = (value: FormDataEntryValue | null) => /^[0-9a-f-]{36}$/i.test(String(value ?? "")) ? String(value) : null;
const positive = (value: FormDataEntryValue | null) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; };

export async function receiveStock(_:InventoryActionState,formData:FormData):Promise<InventoryActionState>{
  const {supabase}=await requireSupplierPermission("inventory.receive");const listing=uuid(formData.get("listingId")),quantity=positive(formData.get("quantity")),unitCost=positive(formData.get("unitCost"));
  if(!listing||!quantity||unitCost===null)return{error:"Choose a product and enter valid quantity and unit cost"};
  const{error}=await supabase.rpc("inventory_receive_stock",{target_listing:listing,target_quantity:quantity,target_unit_cost:unitCost,target_vendor:String(formData.get("vendor")??""),target_invoice:String(formData.get("invoice")??""),target_received_date:String(formData.get("receivedDate")??new Date().toISOString().slice(0,10)),target_notes:String(formData.get("notes")??"")});
  if(error)return{error:error.message};revalidatePath("/supplier/inventory");revalidatePath("/supplier/products");return{message:"Stock receipt recorded"};
}

export async function adjustStock(_:InventoryActionState,formData:FormData):Promise<InventoryActionState>{
  const {supabase}=await requireSupplierPermission("inventory.adjust");const listing=uuid(formData.get("listingId")),quantity=positive(formData.get("quantity")),type=String(formData.get("movementType")??""),reason=String(formData.get("reason")??"").trim();
  if(!listing||!quantity||reason.length<5)return{error:"Choose a product, quantity and detailed reason"};
  const{error}=await supabase.rpc("inventory_adjust_stock",{target_listing:listing,target_type:type,target_quantity:quantity,target_reason:reason,target_notes:String(formData.get("notes")??"")});
  if(error)return{error:error.message};revalidatePath("/supplier/inventory");revalidatePath("/supplier/products");return{message:"Inventory adjustment recorded"};
}

export async function transferStock(_:InventoryActionState,formData:FormData):Promise<InventoryActionState>{
  const {supabase}=await requireSupplierPermission("inventory.transfer");const source=uuid(formData.get("sourceListing")),destination=uuid(formData.get("destinationListing")),quantity=positive(formData.get("quantity")),reason=String(formData.get("reason")??"").trim();
  if(!source||!destination||!quantity||reason.length<5)return{error:"Choose source, destination, quantity and reason"};
  const{error}=await supabase.rpc("inventory_transfer_stock",{source_listing:source,destination_listing:destination,target_quantity:quantity,target_reason:reason});
  if(error)return{error:error.message};revalidatePath("/supplier/inventory");return{message:"Stock transfer recorded"};
}

export async function configureInventory(_:InventoryActionState,formData:FormData):Promise<InventoryActionState>{
  const {supabase}=await requireSupplierPermission("inventory.configure");const listing=uuid(formData.get("listingId"));if(!listing)return{error:"Choose a product"};
  const numberOrNull=(name:string)=>{const value=String(formData.get(name)??"").trim();return value===""?null:Number(value)};
  const{error}=await supabase.rpc("inventory_configure_listing",{target_listing:listing,target_mode:String(formData.get("inventoryMode")??"confirmation_required"),target_show_exact:formData.get("showExact")==="on",target_reorder:numberOrNull("reorderPoint"),target_preferred_reorder:numberOrNull("preferredReorder")});
  if(error)return{error:error.message};revalidatePath("/supplier/inventory");revalidatePath("/supplier/products");return{message:"Inventory configuration updated"};
}

export async function processReturn(_:InventoryActionState,formData:FormData):Promise<InventoryActionState>{
  const{supabase}=await requireSupplierPermission("inventory.adjust");const item=uuid(formData.get("orderItemId")),requestKey=uuid(formData.get("requestKey")),quantity=positive(formData.get("quantity")),disposition=String(formData.get("disposition")??""),reason=String(formData.get("reason")??"").trim();
  if(!item||!requestKey||!quantity||reason.length<5)return{error:"Choose an item, quantity, disposition and detailed reason"};
  const{error}=await supabase.rpc("inventory_record_return",{target_order_item:item,target_quantity:quantity,target_disposition:disposition,target_reason:reason,target_notes:String(formData.get("notes")??""),target_request_key:requestKey});
  if(error)return{error:error.message};revalidatePath("/supplier/inventory");revalidatePath("/supplier/products");return{message:"Return disposition recorded"};
}
