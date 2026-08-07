import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import {getCustomerOrganisationMembership} from "@/lib/organisations/access";
import {OrganisationSwitcher} from "@/components/organisations/OrganisationSwitcher";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireUser();
  const{membership,organisationChoices}=await getCustomerOrganisationMembership();
  return <>{membership&&<div className="border-b bg-brand-50 px-4 py-2"><div className="container-shell flex items-center justify-end gap-2"><span className="text-xs text-slate-600">Customer organisation</span><OrganisationSwitcher scope="customer" currentId={membership.organisation_id} choices={organisationChoices}/></div></div>}{children}</>;
}
