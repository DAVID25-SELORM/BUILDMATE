import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerQuotesView } from "@/components/dashboard/PortalSectionViews";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
export default async function CustomerQuotesPage(){const{user}=await requireUser();const{data}=await(await createClient()).from("quote_requests").select("id,title,delivery_location,status,created_at,supplier_quotes(count)").eq("requester_id",user.id).order("created_at",{ascending:false});return <DashboardShell title="Customer workspace" nav={[{label:"Overview",href:"/dashboard"},{label:"Quotations",href:"/dashboard/quotes"}]}><CustomerQuotesView requests={data??[]}/></DashboardShell>}
