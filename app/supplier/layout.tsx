import type { ReactNode } from "react";
import { requireSupplierPermission } from "@/lib/organisations/access";
import {OrganisationSwitcher} from "@/components/organisations/OrganisationSwitcher";

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const{membership,organisationChoices}=await requireSupplierPermission("supplier.profile.view");
  return <><div className="border-b bg-brand-50 px-4 py-2"><div className="container-shell flex items-center justify-end gap-2"><span className="text-xs text-slate-600">Supplier organisation</span><OrganisationSwitcher scope="supplier" currentId={membership.organisationId} choices={organisationChoices}/></div></div>{children}</>;
}
