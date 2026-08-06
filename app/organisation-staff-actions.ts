"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInvitationToken } from "@/lib/invitations/token";
import { sendNotification } from "@/lib/notifications/sender";
import { requireSupplierPermission,requireCustomerOrganisationPermission } from "@/lib/organisations/access";
import { ORGANISATION_ROLE_LABELS,type OrganisationScope } from "@/lib/permissions/organisation";

export type OrganisationStaffState={error?:string;message?:string}|null;

async function context(scope:OrganisationScope,permission:string){
 if(scope==="supplier"){const c=await requireSupplierPermission(permission);return {supabase:c.supabase,organisationId:c.membership.organisationId};}
 const c=await requireCustomerOrganisationPermission(permission);return {supabase:c.supabase,organisationId:c.membership.organisation_id};
}
function basePath(scope:OrganisationScope){return scope==="supplier"?"/supplier/staff":"/dashboard/organisation/staff";}
function invitationUrl(token:string){return `${process.env.NEXT_PUBLIC_APP_URL??"https://buildmate-six.vercel.app"}/invite/${token}`;}

export async function inviteOrganisationStaff(scope:OrganisationScope,_previous:OrganisationStaffState,formData:FormData):Promise<OrganisationStaffState>{
 const permission=scope==="supplier"?"supplier.staff.invite":"staff.invite";
 const {supabase,organisationId}=await context(scope,permission);
 const fullName=String(formData.get("fullName")??"").trim(),email=String(formData.get("email")??"").trim().toLowerCase(),phone=String(formData.get("phone")??"").trim(),roleKey=String(formData.get("roleKey")??"").trim(),reason=String(formData.get("reason")??"").trim();
 if(fullName.length<2)return{error:"Enter the staff member's full name"};
 if(!email.includes("@"))return{error:"Enter a valid email address"};
 if(!roleKey||!(roleKey in ORGANISATION_ROLE_LABELS[scope]))return{error:"Choose a valid role"};
 if(reason.length<5)return{error:"Provide an audit reason of at least 5 characters"};
 const {token,tokenHash}=generateInvitationToken();
 const {error}=await supabase.rpc("invite_organisation_staff",{target_organisation:organisationId,target_email:email,target_full_name:fullName,target_phone:phone||null,target_role_key:roleKey,target_extra_permissions:formData.getAll("extraPermissions").map(String),target_branch_ids:formData.getAll("branchIds").map(String),target_warehouse_ids:formData.getAll("warehouseIds").map(String),target_project_ids:formData.getAll("projectIds").map(String),target_approval_limit:formData.get("approvalLimit")?Number(formData.get("approvalLimit")):null,target_token_hash:tokenHash,target_reason:reason});
 if(error)return{error:error.message};
 try{await sendNotification({channel:"email",template_key:"staff_invitation",payload:{fullName,roleLabel:ORGANISATION_ROLE_LABELS[scope][roleKey as keyof typeof ORGANISATION_ROLE_LABELS[typeof scope]],inviteUrl:invitationUrl(token)},recipient_email:email,recipient_phone:null});}catch{return{error:"The invitation was created, but email delivery failed. Use Resend from the staff list."};}
 redirect(basePath(scope));
}

export async function changeOrganisationMemberStatus(scope:OrganisationScope,membershipId:string,status:"active"|"suspended"|"removed",formData:FormData){
 const permission=scope==="supplier"?"supplier.staff.manage":"staff.manage"; const {supabase}=await context(scope,permission); const reason=String(formData.get("reason")??"").trim();
 const{error}=await supabase.rpc("set_organisation_member_status",{target_membership:membershipId,target_status:status,target_reason:reason});
 if(error)throw new Error(error.message); revalidatePath(basePath(scope));
}

export async function changeOrganisationMemberRole(scope:OrganisationScope,membershipId:string,formData:FormData){
 const permission=scope==="supplier"?"supplier.staff.manage":"staff.manage"; const {supabase}=await context(scope,permission); const reason=String(formData.get("reason")??"").trim();
 const{error}=await supabase.rpc("set_organisation_member_role",{target_membership:membershipId,target_role_key:String(formData.get("roleKey")??""),target_reason:reason});
 if(error)throw new Error(error.message); revalidatePath(basePath(scope));
}
