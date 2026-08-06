import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerOrdersView } from "@/components/dashboard/PortalSectionViews";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export default async function OrdersPage(){const{user}=await requireUser();const{data}=await(await createClient()).from("orders").select("id,order_number,status,total,created_at,organisations(name)").eq("customer_id",user.id).order("created_at",{ascending:false});return <DashboardShell title="Customer workspace" nav={[{label:"Overview",href:"/dashboard"},{label:"Orders",href:"/dashboard/orders"},{label:"Quotations",href:"/dashboard/quotes"}]}><CustomerOrdersView orders={data??[]}/></DashboardShell>}
