"use server";
import{revalidatePath}from"next/cache";import{requireSupplierPermission}from"@/lib/organisations/access";
export async function progressOrder(orderId:string,status:"confirmed"|"preparing"|"ready_for_dispatch"){const{supabase}=await requireSupplierPermission("orders.accept");const{error}=await supabase.rpc("supplier_progress_order",{target_order:orderId,new_status:status});if(error)throw new Error(error.message);revalidatePath("/supplier/orders")}
