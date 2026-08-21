import Link from "next/link";
import { InviteOrganisationStaffForm } from "@/components/organisations/InviteOrganisationStaffForm";
import { SupplierPageHeader } from "@/components/supplier/SupplierPageHeader";
import { requireSupplierPermission } from "@/lib/organisations/access";

export default async function InviteSupplierStaffPage() {
  const { supabase, membership } = await requireSupplierPermission("supplier.staff.invite");
  const [{ data: branches }, { data: warehouses }] = await Promise.all([supabase.from("supplier_branches").select("id,name").eq("organisation_id", membership.organisationId), supabase.from("supplier_warehouses").select("id,name").eq("organisation_id", membership.organisationId)]);
  return <><Link href="/supplier/staff" className="mb-3 inline-block text-sm font-semibold text-emerald-700">← Back to staff</Link><SupplierPageHeader title="Invite supplier staff" description="Assign the role and operational locations before sending the secure link." /><InviteOrganisationStaffForm scope="supplier" branches={branches ?? []} warehouses={warehouses ?? []} /></>;
}
