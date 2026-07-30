"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/components/supplier/onboarding/Field";
import { StepActions } from "@/components/supplier/onboarding/StepActions";
import { BUSINESS_TYPES, BUSINESS_TYPE_LABELS, PRODUCT_CATEGORIES } from "@/lib/supplier/constants";
import { businessInformationSchema, type BusinessInformationInput } from "@/lib/supplier/validation";
import { saveBusinessInformation } from "@/app/supplier/onboarding/actions";

export function BusinessInformationStep({
  organisationId,
  initial,
  completedSteps,
  showBack,
  onBack,
  onSaved
}: {
  organisationId: string;
  initial: BusinessInformationInput;
  completedSteps: string[];
  showBack: boolean;
  onBack: () => void;
  onSaved: (advance: boolean) => void;
}) {
  const [values, setValues] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleCategory(category: string) {
    setValues((prev) => ({
      ...prev,
      primaryCategories: prev.primaryCategories.includes(category)
        ? prev.primaryCategories.filter((c) => c !== category)
        : [...prev.primaryCategories, category]
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setFieldErrors({});

    const parsed = businessInformationSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      setError("Fix the highlighted fields to continue");
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const advance = submitter?.value !== "draft";

    setLoading(true);
    const result = await saveBusinessInformation(organisationId, parsed.data, completedSteps);
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
        <h2 className="text-xl font-bold">Business information</h2>
        <p className="mt-1 text-sm text-slate-600">Tell us about the business applying to sell on BuildMate.</p>
      </div>

      <Field label="Registered business name" htmlFor="registeredName" error={fieldErrors.registeredName}>
        <input id="registeredName" className="input" value={values.registeredName} onChange={(e) => setValues({ ...values, registeredName: e.target.value })} required />
      </Field>

      <Field label="Trading name (if different)" htmlFor="tradingName" error={fieldErrors.tradingName}>
        <input id="tradingName" className="input" value={values.tradingName} onChange={(e) => setValues({ ...values, tradingName: e.target.value })} />
      </Field>

      <Field label="Business type" htmlFor="businessType" error={fieldErrors.businessType}>
        <select id="businessType" className="input" value={values.businessType} onChange={(e) => setValues({ ...values, businessType: e.target.value as typeof values.businessType })}>
          {BUSINESS_TYPES.map((type) => (
            <option key={type} value={type}>{BUSINESS_TYPE_LABELS[type]}</option>
          ))}
        </select>
      </Field>

      <Field label="Business description" htmlFor="businessDescription" error={fieldErrors.businessDescription}>
        <textarea id="businessDescription" className="input min-h-28" value={values.businessDescription} onChange={(e) => setValues({ ...values, businessDescription: e.target.value })} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Year established" htmlFor="yearEstablished" error={fieldErrors.yearEstablished}>
          <input id="yearEstablished" className="input" type="number" value={values.yearEstablished} onChange={(e) => setValues({ ...values, yearEstablished: Number(e.target.value) })} />
        </Field>
        <Field label="Website (optional)" htmlFor="website" error={fieldErrors.website}>
          <input id="website" className="input" value={values.website} onChange={(e) => setValues({ ...values, website: e.target.value })} />
        </Field>
      </div>

      <Field label="Primary product categories" htmlFor="primaryCategories" error={fieldErrors.primaryCategories}>
        <div className="grid gap-2 sm:grid-cols-2">
          {PRODUCT_CATEGORIES.map((category) => (
            <label key={category} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={values.primaryCategories.includes(category)} onChange={() => toggleCategory(category)} />
              {category}
            </label>
          ))}
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Number of branches" htmlFor="numberOfBranches" error={fieldErrors.numberOfBranches}>
          <input id="numberOfBranches" className="input" type="number" min={1} value={values.numberOfBranches} onChange={(e) => setValues({ ...values, numberOfBranches: Number(e.target.value) })} />
        </Field>
        <Field label="Number of employees" htmlFor="numberOfEmployees" error={fieldErrors.numberOfEmployees}>
          <input id="numberOfEmployees" className="input" type="number" min={1} value={values.numberOfEmployees} onChange={(e) => setValues({ ...values, numberOfEmployees: Number(e.target.value) })} />
        </Field>
      </div>

      <StepActions showBack={showBack} onBack={onBack} loading={loading} error={error} />
    </form>
  );
}
