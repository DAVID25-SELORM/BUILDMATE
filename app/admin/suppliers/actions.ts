"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { VerificationLevel } from "@/lib/supplier/constants";

type ActionResult = { success: true } | { success: false; error: string };
export type SupplierAdminState = { error?: string; message?: string } | null;

function refresh(organisationId: string) {
  revalidatePath(`/admin/suppliers/${organisationId}`);
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin");
}

async function callStatusRpc(
  organisationId: string,
  newStatus: string,
  reason?: string,
  verificationLevels?: VerificationLevel[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_supplier_status", {
    target_org: organisationId,
    new_status: newStatus,
    reason: reason ?? null,
    new_verification_levels: verificationLevels ?? null
  });
  if (error) return { success: false, error: error.message };
  refresh(organisationId);
  return { success: true };
}

export async function startReview(organisationId: string, reason: string): Promise<ActionResult> {
  if (reason.trim().length < 5) return { success: false, error: "A review reason is required" };
  return callStatusRpc(organisationId, "under_review", reason);
}

export async function approveSupplier(organisationId: string, verificationLevels: VerificationLevel[], reason: string): Promise<ActionResult> {
  if (reason.trim().length < 5) return { success: false, error: "An approval reason is required" };
  return callStatusRpc(organisationId, "approved", reason, verificationLevels);
}

export async function rejectSupplier(organisationId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { success: false, error: "A rejection reason is required" };
  return callStatusRpc(organisationId, "rejected", reason);
}

export async function requestInformation(organisationId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { success: false, error: "Explain what information is needed" };
  return callStatusRpc(organisationId, "information_required", reason);
}

export async function suspendSupplier(organisationId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { success: false, error: "A suspension reason is required" };
  return callStatusRpc(organisationId, "suspended", reason);
}

export async function reinstateSupplier(organisationId: string, reason: string): Promise<ActionResult> {
  if (reason.trim().length < 5) return { success: false, error: "A reinstatement reason is required" };
  return callStatusRpc(organisationId, "approved", reason);
}

export async function assignReviewer(organisationId: string, reviewerId: string, reason: string): Promise<ActionResult> {
  if (reason.trim().length < 5) return { success: false, error: "An assignment reason is required" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_supplier_reviewer_v2", { target_org: organisationId, reviewer: reviewerId, target_reason: reason });
  if (error) return { success: false, error: error.message };
  refresh(organisationId);
  return { success: true };
}

export async function addReviewNote(organisationId: string, note: string): Promise<ActionResult> {
  if (!note.trim()) return { success: false, error: "Note cannot be empty" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_supplier_review_note", { target_org: organisationId, note_text: note });
  if (error) return { success: false, error: error.message };
  refresh(organisationId);
  return { success: true };
}

export async function getAdminDocumentSignedUrl(storagePath: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("supplier-documents").createSignedUrl(storagePath, 60);
  if (error || !data) return { error: error?.message ?? "Unable to generate a link" };
  return { url: data.signedUrl };
}

export async function manageSupplierControl(organisationId:string,action:string,_state:SupplierAdminState,formData:FormData):Promise<SupplierAdminState>{const reason=String(formData.get("reason")??"").trim();if(reason.length<5)return{error:"Provide a reason of at least 5 characters"};const{error}=await(await createClient()).rpc("admin_manage_supplier",{target_supplier:organisationId,target_action:action,target_reason:reason});if(error)return{error:error.message};refresh(organisationId);return{message:"Supplier control updated and audited"}}
export async function changeSettlementHold(organisationId:string,hold:boolean,_state:SupplierAdminState,formData:FormData):Promise<SupplierAdminState>{const reason=String(formData.get("reason")??"").trim();if(reason.length<5)return{error:"Provide a reason of at least 5 characters"};const{error}=await(await createClient()).rpc("admin_set_settlement_hold",{target_supplier:organisationId,hold,target_reason:reason});if(error)return{error:error.message};refresh(organisationId);return{message:hold?"Settlements placed on hold":"Settlement hold released"}}
export async function startSupplierPreview(organisationId:string,formData:FormData){const reason=String(formData.get("reason")??"").trim();if(reason.length<5)throw new Error("A preview reason is required");const h=await headers();const supabase=await createClient();const{data,error}=await supabase.rpc("start_admin_portal_preview",{target_portal:"supplier",target_user:null,target_organisation:organisationId,target_reason:reason,target_reference:String(formData.get("referenceNumber")??"")||null,request_ip:h.get("x-forwarded-for")?.split(",")[0]?.trim()??null,request_user_agent:h.get("user-agent")??null});if(error||!data)throw new Error(error?.message??"Unable to start preview");const{error:contextError}=await supabase.rpc("configure_admin_portal_preview_context",{target_session:data,target_role_key:String(formData.get("previewRole")??"owner"),target_branch:String(formData.get("previewBranch")??"")||null,target_warehouse:String(formData.get("previewWarehouse")??"")||null,target_project:null});if(contextError)throw new Error(contextError.message);(await cookies()).set("admin_portal_preview",String(data),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:1800});redirect(`/admin/preview/supplier/${organisationId}`)}
