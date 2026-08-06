import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SupplierQuotesView } from "@/components/dashboard/PortalSectionViews";
import { createClient } from "@/lib/supabase/server";
export default async function SupplierQuotesPage(){const{data}=await(await createClient()).from("quote_requests").select("id,title,delivery_location,required_date,notes,created_at,quote_request_items(description,quantity,unit)").eq("status","open").order("created_at",{ascending:false});return <DashboardShell title="Supplier portal" nav={[{label:"Overview",href:"/supplier"},{label:"Quotation requests",href:"/supplier/quotes"},{label:"Products",href:"/supplier/products"}]}><SupplierQuotesView requests={data??[]}/></DashboardShell>}
