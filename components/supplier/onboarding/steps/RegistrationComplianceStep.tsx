"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/components/supplier/onboarding/Field";
import { StepActions } from "@/components/supplier/onboarding/StepActions";
import { registrationComplianceSchema, type RegistrationComplianceInput } from "@/lib/supplier/validation";
import { saveRegistrationCompliance } from "@/app/supplier/onboarding/actions";

export function RegistrationComplianceStep({
  organisationId,
  initial,
  completedSteps,
  onBack,
  onSaved
}: {
  organisationId: string;
  initial: RegistrationComplianceInput;
  completedSteps: string[];
  onBack: () => void;
  onSaved: (advance: boolean) => void;
}) {
  const [values, setValues] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setFieldErrors({});

    const parsed = registrationComplianceSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      setError("Fix the highlighted fields to continue");
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const advance = submitter?.value !== "draft";

    setLoading(true);
    const result = await saveRegistrationCompliance(organisationId, parsed.data, completedSteps);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved(advance);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="card space-y-5 p-6">
      <div>
        <h2 className="text-xl font-bold">Business registration</h2>
        <p className="mt-1 text-sm text-slate-600">Registration and compliance details used to verify the business.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Business registration number" htmlFor="registrationNumber" error={fieldErrors.registrationNumber}>
          <input id="registrationNumber" className="input" value={values.registrationNumber} onChange={(e) => setValues({ ...values, registrationNumber: e.target.value })} />
        </Field>
        <Field label="Tax Identification Number (TIN)" htmlFor="tin" error={fieldErrors.tin}>
          <input id="tin" className="input" value={values.tin} onChange={(e) => setValues({ ...values, tin: e.target.value })} />
        </Field>
      </div>

      <Field label="VAT registered?" htmlFor="vatRegistered" error={fieldErrors.vatRegistered}>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="vatRegistered" checked={values.vatRegistered} onChange={() => setValues({ ...values, vatRegistered: true })} /> Yes</label>
          <label className="flex items-center gap-2"><input type="radio" name="vatRegistered" checked={!values.vatRegistered} onChange={() => setValues({ ...values, vatRegistered: false, vatNumber: "" })} /> No</label>
        </div>
      </Field>

      {values.vatRegistered && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="VAT registration number" htmlFor="vatNumber" error={fieldErrors.vatNumber}>
            <input id="vatNumber" className="input" value={values.vatNumber} onChange={(e) => setValues({ ...values, vatNumber: e.target.value })} />
          </Field>
          <Field label="VAT certificate expiry" htmlFor="vatCertificateExpiry" error={fieldErrors.vatCertificateExpiry}>
            <input id="vatCertificateExpiry" className="input" type="date" value={values.vatCertificateExpiry} onChange={(e) => setValues({ ...values, vatCertificateExpiry: e.target.value })} />
          </Field>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Ghana Standards Authority registration (if applicable)" htmlFor="gsaRegistrationNumber" error={fieldErrors.gsaRegistrationNumber}>
          <input id="gsaRegistrationNumber" className="input" value={values.gsaRegistrationNumber} onChange={(e) => setValues({ ...values, gsaRegistrationNumber: e.target.value })} />
        </Field>
        <Field label="Manufacturer / distributor authorisation number (if applicable)" htmlFor="distributorAuthorisationNumber" error={fieldErrors.distributorAuthorisationNumber}>
          <input id="distributorAuthorisationNumber" className="input" value={values.distributorAuthorisationNumber} onChange={(e) => setValues({ ...values, distributorAuthorisationNumber: e.target.value })} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Registration certificate expiry (if any)" htmlFor="registrationDocumentExpiry" error={fieldErrors.registrationDocumentExpiry}>
          <input id="registrationDocumentExpiry" className="input" type="date" value={values.registrationDocumentExpiry} onChange={(e) => setValues({ ...values, registrationDocumentExpiry: e.target.value })} />
        </Field>
        <Field label="Distributor authorisation expiry (if any)" htmlFor="distributorAuthorisationExpiry" error={fieldErrors.distributorAuthorisationExpiry}>
          <input id="distributorAuthorisationExpiry" className="input" type="date" value={values.distributorAuthorisationExpiry} onChange={(e) => setValues({ ...values, distributorAuthorisationExpiry: e.target.value })} />
        </Field>
      </div>

      <StepActions showBack onBack={onBack} loading={loading} error={error} />
    </form>
  );
}
