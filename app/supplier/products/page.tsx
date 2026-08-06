import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SupplierProductsView } from "@/components/dashboard/PortalSectionViews";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSupplierMembership } from "@/lib/supplier/data";
export default async function SupplierProductsPage(){const{user}=await requireRole(["supplier"]);const s=await createClient();const m=await getSupplierMembership(s,user.id);if(!m||m.organisation.verification_status!=="approved")redirect("/supplier");const[{data:products},{data:listings}]=await Promise.all([s.from("products").select("id,name,base_unit").eq("is_active",true).order("name"),s.from("supplier_listings").select("id,sku,price,stock_quantity,stock_status,lead_time_days,is_active,products(name,base_unit)").eq("supplier_id",m.organisationId).order("created_at",{ascending:false})]);return <DashboardShell title="Supplier portal" nav={[{label:"Overview",href:"/supplier"},{label:"Products",href:"/supplier/products"}]}><SupplierProductsView listings={listings??[]} products={products??[]}/></DashboardShell>}
