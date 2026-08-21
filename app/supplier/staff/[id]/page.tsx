import { notFound } from "next/navigation";
import { OrganisationStaffDetail } from "@/components/organisations/OrganisationStaffDetail";
import { requireSupplierPermission } from "@/lib/organisations/access";

export default async function SupplierStaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, membership } = await requireSupplierPermission("supplier.staff.manage");
  const [{ data: staffRows }, { data: branches }, { data: warehouses }, { data: branchLinks }, { data: warehouseLinks }, { data: overrides }, { data: audit }] = await Promise.all([
    supabase.rpc("list_organisation_staff", { target_organisation: membership.organisationId }),
    supabase.from("supplier_branches").select("id,name").eq("organisation_id", membership.organisationId),
    supabase.from("supplier_warehouses").select("id,name").eq("organisation_id", membership.organisationId),
    supabase.from("branch_memberships").select("branch_id").eq("membership_id", id),
    supabase.from("warehouse_memberships").select("warehouse_id").eq("membership_id", id),
    supabase.from("membership_permission_overrides").select("granted,organisation_permissions(key)").eq("membership_id", id),
    supabase.from("membership_audit_log").select("id,action,reason,created_at").eq("target_membership_id", id).order("created_at", { ascending: false }),
  ]);
  const staff = (staffRows ?? []).find((row: { membership_id: string }) => row.membership_id === id);
  if (!staff) notFound();
  const overrideMap = Object.fromEntries((overrides ?? []).map((row) => [(row.organisation_permissions as unknown as { key: string }).key, row.granted]));
  return <OrganisationStaffDetail scope="supplier" staff={staff} allStaff={staffRows ?? []} branches={branches ?? []} warehouses={warehouses ?? []} projects={[]} selectedBranches={(branchLinks ?? []).map((row) => row.branch_id)} selectedWarehouses={(warehouseLinks ?? []).map((row) => row.warehouse_id)} selectedProjects={[]} approvalLimit={null} overrides={overrideMap} audit={audit ?? []} />;
}
