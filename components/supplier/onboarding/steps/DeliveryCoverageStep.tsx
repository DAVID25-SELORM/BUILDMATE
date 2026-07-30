"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/components/supplier/onboarding/Field";
import { StepActions } from "@/components/supplier/onboarding/StepActions";
import { DELIVERY_HANDLERS, DELIVERY_HANDLER_LABELS, GHANA_REGIONS } from "@/lib/supplier/constants";
import { deliveryCoverageSchema, type DeliveryCoverageInput } from "@/lib/supplier/validation";
import { saveDeliveryCoverage } from "@/app/supplier/onboarding/actions";

export function DeliveryCoverageStep({
  organisationId,
  initial,
  completedSteps,
  onBack,
  onSaved
}: {
  organisationId: string;
  initial: DeliveryCoverageInput;
  completedSteps: string[];
  onBack: () => void;
  onSaved: (advance: boolean) => void;
}) {
  const [values, setValues] = useState(initial);
  const [citiesText, setCitiesText] = useState(initial.citiesServed.join(", "));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleRegion(region: string) {
    setValues((prev) => ({
      ...prev,
      regionsServed: prev.regionsServed.includes(region) ? prev.regionsServed.filter((r) => r !== region) : [...prev.regionsServed, region]
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setFieldErrors({});

    const citiesServed = citiesText.split(",").map((c) => c.trim()).filter(Boolean);
    const parsed = deliveryCoverageSchema.safeParse({ ...values, citiesServed });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      setError("Fix the highlighted fields to continue");
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const advance = submitter?.value !== "draft";

    setLoading(true);
    const result = await saveDeliveryCoverage(organisationId, parsed.data, completedSteps);
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
        <h2 className="text-xl font-bold">Delivery coverage</h2>
        <p className="mt-1 text-sm text-slate-600">Where and how this business can fulfil orders.</p>
      </div>

      <Field label="Regions served" htmlFor="regionsServed" error={fieldErrors.regionsServed}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {GHANA_REGIONS.map((region) => (
            <label key={region} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={values.regionsServed.includes(region)} onChange={() => toggleRegion(region)} />
              {region}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Cities or areas served" htmlFor="citiesServed" error={fieldErrors.citiesServed} hint="Comma separated, e.g. Spintex, Tema, Kasoa">
        <input id="citiesServed" className="input" value={citiesText} onChange={(e) => setCitiesText(e.target.value)} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Maximum delivery radius (km)" htmlFor="maxDeliveryRadiusKm" error={fieldErrors.maxDeliveryRadiusKm}>
          <input id="maxDeliveryRadiusKm" className="input" type="number" min={0} value={values.maxDeliveryRadiusKm ?? ""} onChange={(e) => setValues({ ...values, maxDeliveryRadiusKm: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Minimum order value (GH₵)" htmlFor="minimumOrderValue" error={fieldErrors.minimumOrderValue}>
          <input id="minimumOrderValue" className="input" type="number" min={0} value={values.minimumOrderValue ?? ""} onChange={(e) => setValues({ ...values, minimumOrderValue: e.target.value ? Number(e.target.value) : null })} />
        </Field>
      </div>

      <Field label="Standard delivery lead time (days)" htmlFor="standardLeadTimeDays" error={fieldErrors.standardLeadTimeDays}>
        <input id="standardLeadTimeDays" className="input" type="number" min={0} value={values.standardLeadTimeDays} onChange={(e) => setValues({ ...values, standardLeadTimeDays: Number(e.target.value) })} />
      </Field>

      <Field label="Who delivers orders?" htmlFor="deliveryHandledBy" error={fieldErrors.deliveryHandledBy}>
        <select id="deliveryHandledBy" className="input" value={values.deliveryHandledBy} onChange={(e) => setValues({ ...values, deliveryHandledBy: e.target.value as typeof values.deliveryHandledBy })}>
          {DELIVERY_HANDLERS.map((handler) => <option key={handler} value={handler}>{DELIVERY_HANDLER_LABELS[handler]}</option>)}
        </select>
      </Field>

      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={values.sameDayDelivery} onChange={(e) => setValues({ ...values, sameDayDelivery: e.target.checked })} /> Same-day delivery available</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={values.customerPickupAvailable} onChange={(e) => setValues({ ...values, customerPickupAvailable: e.target.checked })} /> Customer pickup available</label>
      </div>

      <StepActions showBack onBack={onBack} loading={loading} error={error} />
    </form>
  );
}
