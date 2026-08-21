import type { ReactNode } from "react";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { SupplierPortalShell } from "@/components/supplier/SupplierPortalShell";

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const { membership, organisationChoices } = await requireSupplierPermission("supplier.profile.view");
  return <SupplierPortalShell organisationId={membership.organisationId} organisationName={membership.organisation.name} organisationChoices={organisationChoices}>{children}</SupplierPortalShell>;
}
