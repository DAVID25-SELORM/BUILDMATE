import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SupplierOrdersView } from "@/components/dashboard/PortalSectionViews";
import { requireRole } from "@/lib/auth/session";
import { getSupplierMembership } from "@/lib/supplier/data";
import { createClient } from "@/lib/supabase/server";
export default async function SupplierOrders(){const{user}=await requireRole(["supplier"]);const s=await createClient();const membership=await getSupplierMembership(s,user.id);const{data}=membership?await s.from("orders").select("id,order_number,status,total,delivery_address,created_at").eq("supplier_id",membership.organisationId).order("created_at",{ascending:false}):{data:[]};return <DashboardShell title="Supplier portal" nav={[{label:"Overview",href:"/supplier"},{label:"Orders",href:"/supplier/orders"},{label:"Quotes",href:"/supplier/quotes"},{label:"Products",href:"/supplier/products"}]}><SupplierOrdersView orders={data??[]}/></DashboardShell>}
