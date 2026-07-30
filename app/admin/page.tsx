import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { count: pendingCount } = await supabase
    .from("organisations")
    .select("id", { count: "exact", head: true })
    .eq("organisation_type", "supplier")
    .in("verification_status", ["submitted", "under_review"]);

  return (
    <DashboardShell
      title="Platform administration"
      nav={["Overview", "Users", "Suppliers", "Catalogue", "Orders", "Quotes", "Payments", "Settlements", "Deliveries", "Disputes", "Reports", "Audit Log", "Settings"]}
    >
      <h1 className="text-3xl font-black">Platform overview</h1>
      <p className="mt-2 text-slate-600">Operational, commercial and trust indicators.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Marketplace sales" value="GH₵ 684k" detail="Month to date" />
        <MetricCard label="Completed orders" value="326" detail="94.8% fulfilment" />
        <MetricCard label="Verified suppliers" value="48" detail="7 awaiting review" />
        <MetricCard label="Open disputes" value="6" detail="2 require action today" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-xl font-bold">Supplier approvals</h2>
          <p className="mt-3 text-sm text-slate-600">Review identity, business, warehouse and payout documents.</p>
          <Link href="/admin/suppliers" className="btn-primary mt-5 inline-flex">
            Review {pendingCount ?? 0} application{pendingCount === 1 ? "" : "s"}
          </Link>
        </div>
        <div className="card p-6">
          <h2 className="text-xl font-bold">Payment reconciliation</h2>
          <p className="mt-3 text-sm text-slate-600">3 gateway transactions require reconciliation.</p>
          <button className="btn-secondary mt-5">Open reconciliation</button>
        </div>
      </div>
    </DashboardShell>
  );
}
