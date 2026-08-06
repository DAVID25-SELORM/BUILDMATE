import {DashboardShell} from "@/components/dashboard/DashboardShell";
import {SupplierQuotesView} from "@/components/dashboard/PortalSectionViews";
import {requireSupplierPermission} from "@/lib/organisations/access";
import {supplierNavigation} from "@/lib/organisations/navigation";
export default async function SupplierQuotesPage(){const{supabase,membership}=await requireSupplierPermission("quotations.view");const{data}=await supabase.from("quote_requests").select("id,title,delivery_location,required_date,notes,created_at,quote_request_items(description,quantity,unit)").eq("status","open").order("created_at",{ascending:false});return <DashboardShell title="Supplier portal" nav={await supplierNavigation(membership.organisationId)}><SupplierQuotesView requests={data??[]}/></DashboardShell>}
