import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBanner } from "@/components/supplier/StatusBanner";
import { createClient } from "@/lib/supabase/server";
import { getSupplierMembership } from "@/lib/supplier/data";
import { getSupplierDashboardDecision } from "@/lib/supplier/routing";

export default async function SupplierDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getSupplierMembership(supabase, user.id);

  if (!membership) {
    redirect("/supplier/onboarding");
  }

  const { organisation } = membership;
  const decision = getSupplierDashboardDecision(organisation.verification_status);

  if (decision.action === "redirect_onboarding") {
    redirect("/supplier/onboarding");
  }

  if (decision.action === "show_status") {
    return (
      <DashboardShell title="Supplier portal" nav={["Overview", "Application status"]}>
        <h1 className="text-3xl font-black">Supplier overview</h1>
        <p className="mt-2 text-slate-600">Trading tools unlock once your application is approved.</p>
        <div className="mt-6">
          <StatusBanner status={organisation.verification_status} reason={organisation.decision_reason ?? organisation.suspended_reason} />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Supplier portal" nav={["Overview", "Orders", "Quotation Requests", "Products", "Inventory", "Deliveries", "Settlements", "Reports", "Staff", "Settings"]}>
      <h1 className="text-3xl font-black">Supplier overview</h1>
      <p className="mt-2 text-slate-600">Monitor orders, quotations and fulfilment performance.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Revenue this month" value="GH₵ 128,450" detail="12.4% above last month" />
        <MetricCard label="Open orders" value="18" detail="5 ready for dispatch" />
        <MetricCard label="Quote win rate" value="37%" detail="22 quotations submitted" />
        <MetricCard label="Supplier score" value="92/100" detail="Excellent fulfilment" />
      </div>
      <div className="card mt-6 p-6">
        <h2 className="text-xl font-bold">Orders requiring attention</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3">Order</th>
                <th>Customer</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["BM-1042", "Adom Estates", "GH₵ 18,600", "Confirm stock"],
                ["BM-1041", "Kwame Mensah", "GH₵ 4,320", "Preparing"],
                ["BM-1039", "Unity Works Ltd", "GH₵ 26,100", "Dispatch today"]
              ].map((r) => (
                <tr className="border-b" key={r[0]}>
                  {r.map((c) => <td className="py-4" key={c}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
