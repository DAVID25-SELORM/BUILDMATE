import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SupplierSettlementsView } from "@/components/dashboard/PortalSectionViews";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSupplierMembership } from "@/lib/supplier/data";
import { settlementBalance } from "@/lib/settlements/reconciliation";
export default async function Settlements(){const{user}=await requireRole(["supplier"]);const s=await createClient();const m=await getSupplierMembership(s,user.id);const{data}=m?await s.from("supplier_ledger_entries").select("id,entry_type,amount,status,description,created_at,settled_at").eq("supplier_id",m.organisationId).order("created_at",{ascending:false}):{data:[]};const rows=(data??[]).map(x=>({...x,amount:Number(x.amount)}));return <DashboardShell title="Supplier portal" nav={[{label:"Overview",href:"/supplier"},{label:"Settlements",href:"/supplier/settlements"}]}><SupplierSettlementsView entries={rows} balance={settlementBalance(rows)}/></DashboardShell>}
