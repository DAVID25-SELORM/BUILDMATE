import { TenantDataControls } from "@/components/organisations/TenantDataControls";
import { SupplierPageHeader } from "@/components/supplier/SupplierPageHeader";
import { requireSupplierPermission } from "@/lib/organisations/access";

export default async function SupplierSettings() {
  const { membership } = await requireSupplierPermission("supplier.profile.edit");
  return <><SupplierPageHeader title="Organisation settings" description={`Manage data rights for ${membership.organisation.name}.`} /><TenantDataControls organisationId={membership.organisationId} /></>;
}
