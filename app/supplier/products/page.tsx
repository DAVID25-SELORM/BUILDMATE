import {redirect} from "next/navigation";
import {DashboardShell} from "@/components/dashboard/DashboardShell";
import {SupplierProductsView} from "@/components/dashboard/PortalSectionViews";
import {requireSupplierPermission} from "@/lib/organisations/access";
import {supplierNavigation} from "@/lib/organisations/navigation";
export default async function SupplierProductsPage(){const{supabase:s,membership:m}=await requireSupplierPermission("products.view");if(m.organisation.verification_status!=="approved")redirect("/supplier");const[{data:products},{data:listings}]=await Promise.all([s.from("products").select("id,name,base_unit").eq("is_active",true).order("name"),s.from("supplier_listings").select("id,sku,price,stock_quantity,stock_status,lead_time_days,is_active,products(name,base_unit)").eq("supplier_id",m.organisationId).order("created_at",{ascending:false})]);return <DashboardShell title="Supplier portal" nav={await supplierNavigation(m.organisationId)}><SupplierProductsView listings={listings??[]} products={products??[]}/></DashboardShell>}
