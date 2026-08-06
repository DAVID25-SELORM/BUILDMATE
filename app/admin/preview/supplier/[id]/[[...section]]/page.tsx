import { notFound } from "next/navigation";
import { PortalPreviewShell } from "@/components/admin/PortalPreviewShell";
import { SupplierOverview } from "@/components/dashboard/SupplierOverview";
import { SupplierOrdersView, SupplierProductsView, SupplierQuotesView, SupplierSettlementsView } from "@/components/dashboard/PortalSectionViews";
import { StatusBanner } from "@/components/supplier/StatusBanner";
import { requirePortalPreview } from "@/lib/admin/portal-preview";
import { settlementBalance } from "@/lib/settlements/reconciliation";
import type { VerificationStatus } from "@/lib/supplier/constants";
import { getSupplierDashboardDecision } from "@/lib/supplier/routing";

export default async function SupplierPortalPreview({ params }: { params: Promise<{ id: string; section?: string[] }> }) {
  const { id, section: segments } = await params;
  const section = segments?.[0] ?? "overview";
  if (!['overview','orders','quotes','products','settlements','application-status'].includes(section)) notFound();
  const { supabase, session } = await requirePortalPreview("supplier", id, `/admin/preview/supplier/${id}/${section}`);
  const [{data:organisation},{data:orders},{count:listingsCount},{data:quotes},{data:listings},{data:requests},{data:ledger}] = await Promise.all([
    supabase.from("organisations").select("name,verification_status,decision_reason,suspended_reason").eq("id",id).eq("organisation_type","supplier").maybeSingle(),
    supabase.from("orders").select("id,order_number,status,total,delivery_address,created_at").eq("supplier_id",id).order("created_at",{ascending:false}),
    supabase.from("supplier_listings").select("id",{count:"exact",head:true}).eq("supplier_id",id).eq("is_active",true),
    supabase.from("supplier_quotes").select("status").eq("supplier_id",id),
    supabase.from("supplier_listings").select("id,sku,price,stock_quantity,stock_status,lead_time_days,is_active,products(name,base_unit)").eq("supplier_id",id).order("created_at",{ascending:false}),
    supabase.from("quote_requests").select("id,title,delivery_location,required_date,notes,created_at,quote_request_items(description,quantity,unit)").eq("status","open").order("created_at",{ascending:false}),
    supabase.from("supplier_ledger_entries").select("id,entry_type,amount,status,description,created_at,settled_at").eq("supplier_id",id).order("created_at",{ascending:false}),
  ]);
  if (!organisation) notFound();
  const status=organisation.verification_status as VerificationStatus;
  const decision=getSupplierDashboardDecision(status);
  const entries=(ledger??[]).map(entry=>({...entry,amount:Number(entry.amount)}));
  let content:React.ReactNode;
  if(section==='orders') content=<SupplierOrdersView orders={orders??[]} readOnly/>;
  else if(section==='quotes') content=<SupplierQuotesView requests={requests??[]} readOnly/>;
  else if(section==='products') content=<SupplierProductsView listings={listings??[]} readOnly/>;
  else if(section==='settlements') content=<SupplierSettlementsView entries={entries} balance={settlementBalance(entries)}/>;
  else if(decision.action==='show_dashboard') content=<SupplierOverview orders={orders??[]} activeListings={listingsCount??0} quoteStatuses={(quotes??[]).map(quote=>quote.status)}/>;
  else content=<><h1 className="text-3xl font-black">Supplier overview</h1><p className="mt-2 text-slate-600">Trading tools unlock once the application is approved.</p><div className="mt-6"><StatusBanner status={status} reason={organisation.decision_reason??organisation.suspended_reason} showAction={false}/></div></>;
  const nav=decision.action==='show_dashboard'?[{label:"Overview"},{label:"Orders",section:"orders"},{label:"Quotation requests",section:"quotes"},{label:"Products",section:"products"},{label:"Settlements",section:"settlements"}]:[{label:"Overview"},{label:"Application status",section:"application-status"}];
  return <PortalPreviewShell portalType="supplier" targetId={id} targetName={organisation.name} reason={session.reason} referenceNumber={session.reference_number} nav={nav}>{content}</PortalPreviewShell>;
}
