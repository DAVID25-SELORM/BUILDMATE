import { TenantDataControls } from "@/components/organisations/TenantDataControls";
import { BranchManager } from "@/components/supplier/settings/BranchManager";
import { SupplierPageHeader } from "@/components/supplier/SupplierPageHeader";
import { requireSupplierPermission } from "@/lib/organisations/access";
import type { SupplierBranchRow } from "@/lib/supplier/types";

export default async function SupplierSettings() {
  const { supabase, membership } = await requireSupplierPermission(
    "supplier.profile.edit",
  );
  const { data: branches } = await supabase
    .from("supplier_branches")
    .select(
      "id,organisation_id,name,branch_type,phone,address,region,city,area,ghanapost_gps,latitude,longitude,operating_hours,contact_person,is_main_branch,supports_pickup,supports_delivery,is_active",
    )
    .eq("organisation_id", membership.organisationId)
    .order("is_main_branch", { ascending: false })
    .order("name");
  return (
    <>
      <SupplierPageHeader
        title="Organisation settings"
        description={`Manage locations and data rights for ${membership.organisation.name}.`}
      />
      <div className="mt-6">
        <BranchManager
          organisationId={membership.organisationId}
          branches={(branches ?? []) as SupplierBranchRow[]}
        />
      </div>
      <div className="mt-6">
        <TenantDataControls organisationId={membership.organisationId} />
      </div>
    </>
  );
}
