import { notFound } from "next/navigation";
import { exitSupportPreview } from "@/app/admin/preview-actions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SupplierOverview } from "@/components/dashboard/SupplierOverview";
import { StatusBanner } from "@/components/supplier/StatusBanner";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { VerificationStatus } from "@/lib/supplier/constants";
import { getSupplierDashboardDecision } from "@/lib/supplier/routing";

export default async function SupplierPreview({
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
    .eq("subject_type", "supplier")
    .eq("subject_id", id)
    .is("ended_at", null)
    .maybeSingle();
  if (!preview) notFound();

  const [{ data: organisation }, { data: orders }, { count: listings }, { data: quotes }] = await Promise.all([
    supabase.from("organisations").select("name,verification_status,decision_reason,suspended_reason").eq("id", id).eq("organisation_type", "supplier").maybeSingle(),
    supabase.from("orders").select("id,order_number,status,total,created_at").eq("supplier_id", id).order("created_at", { ascending: false }),
    supabase.from("supplier_listings").select("id", { count: "exact", head: true }).eq("supplier_id", id).eq("is_active", true),
    supabase.from("supplier_quotes").select("status").eq("supplier_id", id),
  ]);
  if (!organisation) notFound();
  const verificationStatus = organisation.verification_status as VerificationStatus;
  const decision = getSupplierDashboardDecision(verificationStatus);
  const navigation = decision.action === "show_dashboard"
    ? ["Overview", "Orders", "Quotation requests", "Products", "Settlements"]
    : ["Overview", "Application status"];

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-20 bg-amber-300 px-4 py-3 text-center text-sm font-bold text-amber-950">
        ADMIN READ-ONLY SUPPLIER PREVIEW · Viewing {organisation.name} · Editing, payments, settlements, bank details and staff controls are disabled.
        <form className="ml-3 inline" action={exitSupportPreview.bind(null, preview.id, `/admin/suppliers/${id}`)}>
          <button className="underline">Exit preview</button>
        </form>
      </div>
      <DashboardShell title="Supplier portal · Read-only preview" nav={navigation}>
        <p className="mb-4 text-sm text-slate-500">Support reason: {preview.reason}</p>
        {decision.action === "show_dashboard" ? (
          <SupplierOverview
            orders={orders ?? []}
            activeListings={listings ?? 0}
            quoteStatuses={(quotes ?? []).map(quote => quote.status)}
          />
        ) : (
          <>
            <h1 className="text-3xl font-black">Supplier overview</h1>
            <p className="mt-2 text-slate-600">
              Trading tools unlock once the application is approved.
            </p>
            <div className="mt-6">
              <StatusBanner
                status={verificationStatus}
                reason={organisation.decision_reason ?? organisation.suspended_reason}
                showAction={false}
              />
            </div>
          </>
        )}
      </DashboardShell>
    </div>
  );
}
