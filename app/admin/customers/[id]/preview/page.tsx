import { notFound } from "next/navigation";
import { exitSupportPreview } from "@/app/admin/preview-actions";
import { CustomerOverview } from "@/components/dashboard/CustomerOverview";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type CustomerPreviewData = {
  profile: { full_name?: string };
  orders: { id?: string; order_number: string; status: string; total: number | string }[];
  quotes: { status?: string }[];
  projects: unknown[];
};

export default async function CustomerPreview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { id } = await params;
  const { session } = await searchParams;
  const { user } = await requireRole(["admin", "super_admin"]);
  const supabase = await createClient();
  const { data: preview } = await supabase
    .from("support_view_sessions")
    .select("id,reason")
    .eq("id", session ?? "")
    .eq("admin_id", user.id)
    .eq("subject_type", "customer")
    .eq("subject_id", id)
    .is("ended_at", null)
    .maybeSingle();
  if (!preview) notFound();
  const { data } = await supabase.rpc("admin_customer_detail", { target_customer: id });
  if (!data) notFound();
  const customer = data as unknown as CustomerPreviewData;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-20 bg-amber-300 px-4 py-3 text-center text-sm font-bold text-amber-950">
        ADMIN READ-ONLY CUSTOMER PREVIEW · Viewing {customer.profile.full_name ?? "customer"} · No purchases, payments, password or security changes are available.
        <form className="ml-3 inline" action={exitSupportPreview.bind(null, preview.id, `/admin/customers/${id}`)}>
          <button className="underline">Exit preview</button>
        </form>
      </div>
      <DashboardShell
        title="Customer workspace · Read-only preview"
        nav={["Overview", "Orders", "Quotations"]}
      >
        <p className="mb-4 text-sm text-slate-500">Support reason: {preview.reason}</p>
        <CustomerOverview
          projects={customer.projects.length}
          openQuotes={customer.quotes.filter(quote => quote.status === "open").length}
          orders={customer.orders}
        />
      </DashboardShell>
    </div>
  );
}
