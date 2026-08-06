import {DashboardShell} from "@/components/dashboard/DashboardShell";
import {SupplierOrdersView} from "@/components/dashboard/PortalSectionViews";
import {requireSupplierPermission} from "@/lib/organisations/access";
import {supplierNavigation} from "@/lib/organisations/navigation";
export default async function SupplierOrders(){const{supabase:s,membership}=await requireSupplierPermission("orders.view");const{data}=await s.from("orders").select("id,order_number,status,total,delivery_address,created_at").eq("supplier_id",membership.organisationId).order("created_at",{ascending:false});return <DashboardShell title="Supplier portal" nav={await supplierNavigation(membership.organisationId)}><SupplierOrdersView orders={data??[]}/></DashboardShell>}
