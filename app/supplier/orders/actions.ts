"use server";
import{revalidatePath}from"next/cache";import{requireRole}from"@/lib/auth/session";import{createClient}from"@/lib/supabase/server";
export async function progressOrder(orderId:string,status:"confirmed"|"preparing"|"ready_for_dispatch"){await requireRole(["supplier"]);const{error}=await(await createClient()).rpc("supplier_progress_order",{target_order:orderId,new_status:status});if(error)throw new Error(error.message);revalidatePath("/supplier/orders")}
