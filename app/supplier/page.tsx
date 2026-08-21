import { redirect } from "next/navigation";
import { SupplierOverview } from "@/components/dashboard/SupplierOverview";
import { StatusBanner } from "@/components/supplier/StatusBanner";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { getSupplierDashboardDecision } from "@/lib/supplier/routing";

export default async function SupplierDashboardPage() {
  const{supabase,membership}=await requireSupplierPermission("supplier.profile.view");
  const { organisation } = membership;
  const decision = getSupplierDashboardDecision(organisation.verification_status);
  if (decision.action === "redirect_onboarding") redirect("/supplier/onboarding");
  if (decision.action === "show_status") {
    return (
      <>
        <h1 className="text-3xl font-black">Supplier overview</h1>
        <p className="mt-2 text-slate-600">
          Trading tools unlock once your application is approved.
        </p>
        <div className="mt-6">
          <StatusBanner
            status={organisation.verification_status}
            reason={organisation.decision_reason ?? organisation.suspended_reason}
          />
        </div>
      </>
    );
  }

  const monthStart=new Date();monthStart.setUTCDate(1);monthStart.setUTCHours(0,0,0,0);
  const [{ data: orders }, { count: listings }, { data: quotes }, {data:financials},{data:inventory}] = await Promise.all([
    supabase.from("orders").select("id,order_number,status,total,created_at,customer:profiles!orders_customer_id_fkey(full_name)").eq("supplier_id", organisation.id).order("created_at", { ascending: false }),
    supabase.from("supplier_listings").select("id", { count: "exact", head: true }).eq("supplier_id", organisation.id).eq("is_active", true),
    supabase.from("supplier_quotes").select("status").eq("supplier_id", organisation.id),
    supabase.rpc("inventory_report",{target_organisation:organisation.id,target_report:"sales_by_product",target_from:monthStart.toISOString().slice(0,10),target_to:new Date().toISOString().slice(0,10)}),
    supabase.rpc("inventory_dashboard",{target_organisation:organisation.id}),
  ]);

  return (
    <>
      <SupplierOverview
        orders={orders ?? []}
        activeListings={listings ?? 0}
        quoteStatuses={(quotes ?? []).map(quote => quote.status)}
        organisationName={organisation.name}
        financials={{...((financials as {summary?:Record<string,number|null>}|null)?.summary??{}),...((inventory as {summary?:Record<string,number|null>}|null)?.summary??{})}}
      />
    </>
  );
}
