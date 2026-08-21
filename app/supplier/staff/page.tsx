import Link from "next/link";
import { OrganisationInvitations } from "@/components/organisations/OrganisationInvitations";
import { OrganisationStaffTable } from "@/components/organisations/OrganisationStaffTable";
import { SupplierPageHeader } from "@/components/supplier/SupplierPageHeader";
import { requireSupplierPermission } from "@/lib/organisations/access";

export default async function SupplierStaffPage() {
  const { supabase, membership } = await requireSupplierPermission("supplier.staff.view");
  const [{ data, error }, { data: invitations }, { data: canInvite }] = await Promise.all([supabase.rpc("list_organisation_staff", { target_organisation: membership.organisationId }), supabase.rpc("list_organisation_invitations", { target_organisation: membership.organisationId }), supabase.rpc("has_permission", { target_permission: "supplier.staff.invite", target_organisation: membership.organisationId })]);
  return <><SupplierPageHeader title="Staff" description={`Roles, assignments and access are isolated to ${membership.organisation.name}.`} actions={canInvite ? <Link className="btn-primary" href="/supplier/staff/invite">Invite staff</Link> : null} />{error && <p className="mt-4 text-red-700">{error.message}</p>}<OrganisationStaffTable scope="supplier" rows={data ?? []} /><OrganisationInvitations scope="supplier" invitations={invitations ?? []} /></>;
}
