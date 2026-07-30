"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/components/supplier/onboarding/Field";
import { StepActions } from "@/components/supplier/onboarding/StepActions";
import { GHANA_REGIONS } from "@/lib/supplier/constants";
import { contactInformationSchema, type ContactInformationInput } from "@/lib/supplier/validation";
import { saveContactInformation } from "@/app/supplier/onboarding/actions";

export function ContactInformationStep({
  organisationId,
  initial,
  completedSteps,
  onBack,
  onSaved
}: {
  organisationId: string;
  initial: ContactInformationInput;
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

    const parsed = contactInformationSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      setError("Fix the highlighted fields to continue");
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const advance = submitter?.value !== "draft";

    setLoading(true);
    const result = await saveContactInformation(organisationId, parsed.data, completedSteps);
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
        <h2 className="text-xl font-bold">Contact information</h2>
        <p className="mt-1 text-sm text-slate-600">Who should BuildMate and customers reach for this account?</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Primary contact name" htmlFor="primaryContactName" error={fieldErrors.primaryContactName}>
          <input id="primaryContactName" className="input" value={values.primaryContactName} onChange={(e) => setValues({ ...values, primaryContactName: e.target.value })} />
        </Field>
        <Field label="Business email" htmlFor="businessEmail" error={fieldErrors.businessEmail}>
          <input id="businessEmail" className="input" type="email" value={values.businessEmail} onChange={(e) => setValues({ ...values, businessEmail: e.target.value })} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Primary phone number" htmlFor="primaryPhone" error={fieldErrors.primaryPhone}>
          <input id="primaryPhone" className="input" value={values.primaryPhone} onChange={(e) => setValues({ ...values, primaryPhone: e.target.value })} />
        </Field>
        <Field label="Alternative phone" htmlFor="alternativePhone" error={fieldErrors.alternativePhone}>
          <input id="alternativePhone" className="input" value={values.alternativePhone} onChange={(e) => setValues({ ...values, alternativePhone: e.target.value })} />
        </Field>
        <Field label="WhatsApp number" htmlFor="whatsappNumber" error={fieldErrors.whatsappNumber}>
          <input id="whatsappNumber" className="input" value={values.whatsappNumber} onChange={(e) => setValues({ ...values, whatsappNumber: e.target.value })} />
        </Field>
      </div>

      <Field label="Physical address" htmlFor="physicalAddress" error={fieldErrors.physicalAddress}>
        <input id="physicalAddress" className="input" value={values.physicalAddress} onChange={(e) => setValues({ ...values, physicalAddress: e.target.value })} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Region" htmlFor="region" error={fieldErrors.region}>
          <select id="region" className="input" value={values.region} onChange={(e) => setValues({ ...values, region: e.target.value })}>
            <option value="">Select a region</option>
            {GHANA_REGIONS.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
        </Field>
        <Field label="City / town" htmlFor="city" error={fieldErrors.city}>
          <input id="city" className="input" value={values.city} onChange={(e) => setValues({ ...values, city: e.target.value })} />
        </Field>
        <Field label="Area" htmlFor="area" error={fieldErrors.area}>
          <input id="area" className="input" value={values.area} onChange={(e) => setValues({ ...values, area: e.target.value })} />
        </Field>
        <Field label="GhanaPost GPS address" htmlFor="ghanaPostGps" error={fieldErrors.ghanaPostGps}>
          <input id="ghanaPostGps" className="input" placeholder="GA-123-4567" value={values.ghanaPostGps} onChange={(e) => setValues({ ...values, ghanaPostGps: e.target.value })} />
        </Field>
      </div>

      <StepActions showBack onBack={onBack} loading={loading} error={error} />
    </form>
  );
}
