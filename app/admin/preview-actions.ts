"use server";
import{redirect}from"next/navigation";import{requireRole}from"@/lib/auth/session";import{createClient}from"@/lib/supabase/server";
export async function exitSupportPreview(sessionId:string,returnTo:string){await requireRole(["admin","super_admin"]);const{error}=await(await createClient()).rpc("end_support_view",{target_session:sessionId});if(error)throw new Error(error.message);redirect(returnTo)}
