import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getSupplierMembership } from "@/lib/supplier/data";
import {resolveActiveOrganisation} from "@/lib/organisations/active";

export async function requireSupplierPermission(permission: string) {
  const { user } = await requireUser();
  const supabase = await createClient();
  const selection=await resolveActiveOrganisation(supabase,user.id,"supplier");
  const membership = await getSupplierMembership(supabase,user.id,selection.active?.id);
  if (!membership) redirect("/dashboard");
  const { data: allowed } = await supabase.rpc("check_permission_audited",{target_permission:permission,target_organisation:membership.organisationId});
  if (!allowed) redirect("/supplier");
  return { user,supabase,membership,organisationChoices:selection.choices };
}

export async function getCustomerOrganisationMembership() {
  const { user } = await requireUser();
  const supabase = await createClient();
  const selection=await resolveActiveOrganisation(supabase,user.id,"customer");
  const { data } = await supabase.from("organisation_members").select("id,organisation_id,member_role,status,organisations!inner(id,name,organisation_type)").eq("user_id",user.id).eq("status","active").eq("is_active",true).eq("organisation_id",selection.active?.id??"00000000-0000-0000-0000-000000000000").limit(1).maybeSingle();
  return { user,supabase,membership:data,organisationChoices:selection.choices };
}

export async function requireCustomerOrganisationPermission(permission: string) {
  const context=await getCustomerOrganisationMembership();
  if(!context.membership) redirect("/dashboard");
  const {data:allowed}=await context.supabase.rpc("check_permission_audited",{target_permission:permission,target_organisation:context.membership.organisation_id});
  if(!allowed) redirect("/dashboard");
  return context as typeof context & {membership:NonNullable<typeof context.membership>};
}
