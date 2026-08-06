import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SupplierOverview } from "@/components/dashboard/SupplierOverview";
import { StatusBanner } from "@/components/supplier/StatusBanner";
import { createClient } from "@/lib/supabase/server";
import { getSupplierMembership } from "@/lib/supplier/data";
import { getSupplierDashboardDecision } from "@/lib/supplier/routing";

export default async function SupplierDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const membership = await getSupplierMembership(supabase, user.id);
  if (!membership) redirect("/supplier/onboarding");
  const { organisation } = membership;
  const decision = getSupplierDashboardDecision(organisation.verification_status);
  if (decision.action === "redirect_onboarding") redirect("/supplier/onboarding");
  if (decision.action === "show_status") {
    return (
      <DashboardShell
        title="Supplier portal"
        nav={[
          { label: "Overview", href: "/supplier" },
          { label: "Application status", href: "/supplier/onboarding" },
        ]}
      >
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
      </DashboardShell>
    );
  }

  const [{ data: orders }, { count: listings }, { data: quotes }] = await Promise.all([
    supabase.from("orders").select("id,order_number,status,total,created_at").eq("supplier_id", organisation.id).order("created_at", { ascending: false }),
    supabase.from("supplier_listings").select("id", { count: "exact", head: true }).eq("supplier_id", organisation.id).eq("is_active", true),
    supabase.from("supplier_quotes").select("status").eq("supplier_id", organisation.id),
  ]);

  return (
    <DashboardShell
      title="Supplier portal"
      nav={[
        { label: "Overview", href: "/supplier" },
        { label: "Orders", href: "/supplier/orders" },
        { label: "Quotation requests", href: "/supplier/quotes" },
        { label: "Products", href: "/supplier/products" },
        { label: "Settlements", href: "/supplier/settlements" },
      ]}
    >
      <SupplierOverview
        orders={orders ?? []}
        activeListings={listings ?? 0}
        quoteStatuses={(quotes ?? []).map(quote => quote.status)}
      />
    </DashboardShell>
  );
}
