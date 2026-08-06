import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getSupplierMembership } from "@/lib/supplier/data";

export async function requireSupplierPermission(permission: string) {
  const { user } = await requireUser();
  const supabase = await createClient();
  const membership = await getSupplierMembership(supabase,user.id);
  if (!membership) redirect("/dashboard");
  const { data: allowed } = await supabase.rpc("has_permission",{target_permission:permission,target_organisation:membership.organisationId});
  if (!allowed) redirect("/supplier");
  return { user,supabase,membership };
}

export async function getCustomerOrganisationMembership() {
  const { user } = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("organisation_members").select("id,organisation_id,member_role,status,organisations(id,name,organisation_type)").eq("user_id",user.id).eq("status","active").eq("is_active",true).neq("organisations.organisation_type","supplier").limit(1).maybeSingle();
  return { user,supabase,membership:data };
}

export async function requireCustomerOrganisationPermission(permission: string) {
  const context=await getCustomerOrganisationMembership();
  if(!context.membership) redirect("/dashboard");
  const {data:allowed}=await context.supabase.rpc("has_permission",{target_permission:permission,target_organisation:context.membership.organisation_id});
  if(!allowed) redirect("/dashboard");
  return context as typeof context & {membership:NonNullable<typeof context.membership>};
}
