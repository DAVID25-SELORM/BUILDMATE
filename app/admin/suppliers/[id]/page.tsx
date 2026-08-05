import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBanner } from "@/components/supplier/StatusBanner";
import { SupplierActionsPanel } from "@/components/admin/suppliers/SupplierActionsPanel";
import { SupplierDocumentList } from "@/components/admin/suppliers/SupplierDocumentList";
import { createClient } from "@/lib/supabase/server";
import { getSupplierOnboardingBundle, getSupplierReviewEvents, getSupplierReviewNotes } from "@/lib/supplier/data";
import { BRANCH_TYPE_LABELS } from "@/lib/supplier/constants";
import type { SupplierOrganisation } from "@/lib/supplier/types";
import { ADMIN_NAV } from "@/lib/admin/navigation";

export default async function AdminSupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: organisation } = await supabase
    .from("organisations")
    .select(
      "id, name, organisation_type, registration_number, tax_id, verification_status, verification_levels, decision_reason, suspended_reason, submitted_at, reviewed_at, approved_at, suspended_at, reviewer_id"
    )
    .eq("id", id)
    .eq("organisation_type", "supplier")
    .maybeSingle();

  if (!organisation) notFound();
  const org = organisation as SupplierOrganisation;

  const [bundle, events, notes, { data: reviewers }] = await Promise.all([
    getSupplierOnboardingBundle(supabase, id),
    getSupplierReviewEvents(supabase, id),
    getSupplierReviewNotes(supabase, id),
    supabase.from("profiles").select("id, full_name").in("role", ["admin", "super_admin"])
  ]);

  const profile = bundle.profile;

  return (
    <DashboardShell
      title="Platform administration"
      nav={[...ADMIN_NAV]}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">{org.name}</h1>
          <p className="mt-1 text-slate-600">Supplier application review</p>
        </div>
        <Link href="/admin/suppliers" className="btn-secondary">Back to list</Link>
      </div>

      <div className="mt-6">
        <StatusBanner status={org.verification_status} reason={org.decision_reason ?? org.suspended_reason} showAction={false} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6">
            <h2 className="text-lg font-bold">Business</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Trading name" value={profile?.trading_name} />
              <Row label="Business type" value={profile?.business_type} />
              <Row label="Registration number" value={org.registration_number} />
              <Row label="TIN" value={org.tax_id} />
              <Row label="VAT registered" value={profile?.vat_registered ? "Yes" : "No"} />
              <Row label="Year established" value={profile?.year_established?.toString()} />
              <Row label="Categories" value={profile?.primary_categories?.join(", ")} />
              <Row label="Website" value={profile?.website} />
            </dl>
            <p className="mt-3 text-sm text-slate-600">{profile?.business_description}</p>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold">Contact</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Contact name" value={profile?.primary_contact_name} />
              <Row label="Phone" value={profile?.primary_phone} />
              <Row label="Alternative phone" value={profile?.alternative_phone} />
              <Row label="Email" value={profile?.business_email} />
              <Row label="WhatsApp" value={profile?.whatsapp_number} />
              <Row label="Address" value={profile?.physical_address} />
              <Row label="Region / City" value={[profile?.city, profile?.region].filter(Boolean).join(", ")} />
              <Row label="GhanaPost GPS" value={profile?.ghanapost_gps} />
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold">Branches ({bundle.branches.length})</h2>
            <div className="mt-3 space-y-2">
              {bundle.branches.map((b) => (
                <div key={b.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <p className="font-semibold">{b.name} {b.is_main_branch && "(main)"}</p>
                  <p className="text-slate-600">{BRANCH_TYPE_LABELS[b.branch_type]} • {b.address}, {b.city}, {b.region}</p>
                </div>
              ))}
              {bundle.branches.length === 0 && <p className="text-sm text-slate-500">No branches submitted.</p>}
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold">Settlement</h2>
            <p className="mt-2 text-sm text-slate-600">
              {bundle.hasSettlement
                ? `Bank account ${bundle.maskedSettlement?.accountNumberMasked || "on file"}, mobile money ${bundle.maskedSettlement?.momoNumberMasked || "on file"}.`
                : "Not provided yet."}
            </p>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold">Documents</h2>
            <div className="mt-3">
              <SupplierDocumentList documents={bundle.documents} />
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold">Review history</h2>
            <div className="mt-3 space-y-3 text-sm">
              {events.map((event) => (
                <div key={event.id} className="border-b border-slate-100 pb-3 last:border-0">
                  <p className="font-semibold">{event.event_type.replace(/_/g, " ")}</p>
                  <p className="text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
                  {event.reason && <p className="mt-1 text-slate-700">Reason: {event.reason}</p>}
                </div>
              ))}
              {events.length === 0 && <p className="text-slate-500">No review activity yet.</p>}
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold">Internal notes</h2>
            <div className="mt-3 space-y-3 text-sm">
              {notes.map((n) => (
                <div key={n.id} className="border-b border-slate-100 pb-3 last:border-0">
                  <p>{n.note}</p>
                  <p className="mt-1 text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))}
              {notes.length === 0 && <p className="text-slate-500">No internal notes yet.</p>}
            </div>
          </section>
        </div>

        <div>
          <SupplierActionsPanel
            organisationId={org.id}
            status={org.verification_status}
            currentVerificationLevels={org.verification_levels}
            reviewers={(reviewers ?? []) as { id: string; full_name: string }[]}
            currentReviewerId={org.reviewer_id}
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="contents">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
}
