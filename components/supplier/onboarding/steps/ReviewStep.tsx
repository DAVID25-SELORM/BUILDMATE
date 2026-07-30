"use client";

import { useState } from "react";
import { ONBOARDING_STEPS, ONBOARDING_STEP_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/supplier/constants";
import { submitSupplierApplication } from "@/app/supplier/onboarding/actions";
import type { SupplierBranchRow, SupplierDeliveryCoverageRow, SupplierDocumentRow, SupplierProfileRow } from "@/lib/supplier/types";

export function ReviewStep({
  organisationId,
  organisationName,
  registrationNumber,
  taxId,
  profile,
  branches,
  delivery,
  documents,
  hasSettlement,
  completedSteps,
  onBack,
  onSubmitted
}: {
  organisationId: string;
  organisationName: string;
  registrationNumber: string | null;
  taxId: string | null;
  profile: SupplierProfileRow | null;
  branches: SupplierBranchRow[];
  delivery: SupplierDeliveryCoverageRow | null;
  documents: SupplierDocumentRow[];
  hasSettlement: boolean;
  completedSteps: string[];
  onBack: () => void;
  onSubmitted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const missingSteps = ONBOARDING_STEPS.filter((step) => step !== "review" && !completedSteps.includes(step));

  async function handleSubmit() {
    if (loading) return;
    setError(null);
    if (missingSteps.length > 0) {
      setError("Complete every step before submitting");
      return;
    }
    setLoading(true);
    const result = await submitSupplierApplication(organisationId);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSubmitted();
  }

  return (
    <div className="card space-y-6 p-6">
      <div>
        <h2 className="text-xl font-bold">Review and submission</h2>
        <p className="mt-1 text-sm text-slate-600">Check everything below before submitting for verification.</p>
      </div>

      {missingSteps.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Finish these steps first:</p>
          <ul className="mt-2 list-disc pl-5">
            {missingSteps.map((step) => <li key={step}>{ONBOARDING_STEP_LABELS[step]}</li>)}
          </ul>
        </div>
      )}

      <section>
        <h3 className="font-bold">Business</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Row label="Registered name" value={organisationName} />
          <Row label="Trading name" value={profile?.trading_name} />
          <Row label="Business type" value={profile?.business_type} />
          <Row label="Registration number" value={registrationNumber} />
          <Row label="TIN" value={taxId} />
          <Row label="Categories" value={profile?.primary_categories?.join(", ")} />
        </dl>
      </section>

      <section>
        <h3 className="font-bold">Contact</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Row label="Contact name" value={profile?.primary_contact_name} />
          <Row label="Phone" value={profile?.primary_phone} />
          <Row label="Email" value={profile?.business_email} />
          <Row label="Location" value={[profile?.city, profile?.region].filter(Boolean).join(", ")} />
        </dl>
      </section>

      <section>
        <h3 className="font-bold">Branches ({branches.length})</h3>
        <ul className="mt-2 text-sm text-slate-600">
          {branches.map((b) => <li key={b.id}>{b.name} — {b.city}, {b.region}{b.is_main_branch ? " (main)" : ""}</li>)}
        </ul>
      </section>

      <section>
        <h3 className="font-bold">Delivery</h3>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <Row label="Regions served" value={delivery?.regions_served?.join(", ")} />
          <Row label="Lead time" value={delivery ? `${delivery.standard_lead_time_days ?? "-"} days` : undefined} />
        </dl>
      </section>

      <section>
        <h3 className="font-bold">Settlement</h3>
        <p className="mt-2 text-sm text-slate-600">{hasSettlement ? "Settlement details on file." : "Not yet provided."}</p>
      </section>

      <section>
        <h3 className="font-bold">Documents ({documents.length})</h3>
        <ul className="mt-2 text-sm text-slate-600">
          {documents.map((d) => <li key={d.id}>{DOCUMENT_TYPE_LABELS[d.document_type]} — {d.file_name}</li>)}
        </ul>
      </section>

      {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <button type="button" className="btn-secondary" onClick={onBack} disabled={loading}>Back</button>
        <button type="button" className="btn-primary" onClick={handleSubmit} disabled={loading || missingSteps.length > 0}>
          {loading ? "Submitting..." : "Submit application"}
        </button>
      </div>
    </div>
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
