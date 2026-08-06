import {DashboardShell} from "@/components/dashboard/DashboardShell";
import {SupplierSettlementsView} from "@/components/dashboard/PortalSectionViews";
import {requireSupplierPermission} from "@/lib/organisations/access";
import {supplierNavigation} from "@/lib/organisations/navigation";
import {settlementBalance} from "@/lib/settlements/reconciliation";
export default async function Settlements(){const{supabase:s,membership:m}=await requireSupplierPermission("settlements.view");const{data}=await s.from("supplier_ledger_entries").select("id,entry_type,amount,status,description,created_at,settled_at").eq("supplier_id",m.organisationId).order("created_at",{ascending:false});const rows=(data??[]).map(x=>({...x,amount:Number(x.amount)}));return <DashboardShell title="Supplier portal" nav={await supplierNavigation(m.organisationId)}><SupplierSettlementsView entries={rows} balance={settlementBalance(rows)}/></DashboardShell>}
