import Link from "next/link";
import {DashboardShell} from "@/components/dashboard/DashboardShell";
import {InviteOrganisationStaffForm} from "@/components/organisations/InviteOrganisationStaffForm";
import {requireCustomerOrganisationPermission} from "@/lib/organisations/access";
import {customerNavigation} from "@/lib/organisations/navigation";
export default async function InviteCustomerStaff(){const{supabase,membership}=await requireCustomerOrganisationPermission("staff.invite");const organisationId=membership.organisation_id;const{data:projects}=await supabase.from("projects").select("id,name").eq("organisation_id",organisationId);return <DashboardShell title="Customer workspace" nav={await customerNavigation(organisationId)}><Link href="/dashboard/organisation/staff" className="text-sm font-semibold text-brand-700">← Back to staff</Link><h1 className="mt-3 text-3xl font-black">Invite organisation staff</h1><p className="mt-2 text-slate-600">Assign a procurement role, projects and optional approval limit.</p><InviteOrganisationStaffForm scope="customer" projects={projects??[]}/></DashboardShell>}
