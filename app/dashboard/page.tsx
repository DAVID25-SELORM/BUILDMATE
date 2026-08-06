import { CustomerOverview } from "@/components/dashboard/CustomerOverview";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerDashboard() {
  const { user } = await requireUser();
  const supabase = await createClient();
  const [{ count: projects }, { count: quotes }, { data: orders }] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    supabase.from("quote_requests").select("id", { count: "exact", head: true }).eq("requester_id", user.id).eq("status", "open"),
    supabase.from("orders").select("id,order_number,status,total,updated_at").eq("customer_id", user.id).order("updated_at", { ascending: false }),
  ]);

  return (
    <DashboardShell
      title="Customer workspace"
      nav={[
        { label: "Overview", href: "/dashboard" },
        { label: "Orders", href: "/dashboard/orders" },
        { label: "Quotations", href: "/dashboard/quotes" },
      ]}
    >
      <CustomerOverview
        projects={projects ?? 0}
        openQuotes={quotes ?? 0}
        orders={orders ?? []}
      />
    </DashboardShell>
  );
}
