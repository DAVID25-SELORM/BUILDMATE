"use client";

import { useState, type FormEvent } from "react";
import { Field } from "@/components/supplier/onboarding/Field";
import { StepActions } from "@/components/supplier/onboarding/StepActions";
import { SETTLEMENT_METHODS } from "@/lib/supplier/constants";
import { settlementSchema, type SettlementInput } from "@/lib/supplier/validation";
import { saveSettlementDetails } from "@/app/supplier/onboarding/actions";

const empty: SettlementInput = {
  settlementMethod: "bank",
  bankName: "",
  accountName: "",
  accountNumber: "",
  momoNetwork: "",
  momoNumber: "",
  momoAccountName: ""
};

export function SettlementStep({
  organisationId,
  hasSettlement,
  maskedAccountNumber,
  maskedMomoNumber,
  completedSteps,
  onBack,
  onSaved
}: {
  organisationId: string;
  hasSettlement: boolean;
  maskedAccountNumber: string;
  maskedMomoNumber: string;
  completedSteps: string[];
  onBack: () => void;
  onSaved: (advance: boolean) => void;
}) {
  const [values, setValues] = useState<SettlementInput>(empty);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setFieldErrors({});

    const parsed = settlementSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      setError("Fix the highlighted fields to continue");
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const advance = submitter?.value !== "draft";

    setLoading(true);
    const result = await saveSettlementDetails(organisationId, parsed.data, completedSteps);
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
        <h2 className="text-xl font-bold">Payment and settlement details</h2>
        <p className="mt-1 text-sm text-slate-600">
          Only the account owner and authorised finance staff can view or change this. Account numbers are masked everywhere in the app after saving.
        </p>
        {hasSettlement && (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Currently saved — bank account {maskedAccountNumber || "not set"}, mobile money {maskedMomoNumber || "not set"}. Re-enter the full number below to change it.
          </p>
        )}
      </div>

      <Field label="Settlement method" htmlFor="settlementMethod" error={fieldErrors.settlementMethod}>
        <select id="settlementMethod" className="input" value={values.settlementMethod} onChange={(e) => setValues({ ...values, settlementMethod: e.target.value as typeof values.settlementMethod })}>
          {SETTLEMENT_METHODS.map((method) => (
            <option key={method} value={method}>{method === "bank" ? "Bank transfer" : "Mobile money"}</option>
          ))}
        </select>
      </Field>

      {values.settlementMethod === "bank" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Bank name" htmlFor="bankName" error={fieldErrors.bankName}>
            <input id="bankName" className="input" value={values.bankName} onChange={(e) => setValues({ ...values, bankName: e.target.value })} />
          </Field>
          <Field label="Account name" htmlFor="accountName" error={fieldErrors.accountName}>
            <input id="accountName" className="input" value={values.accountName} onChange={(e) => setValues({ ...values, accountName: e.target.value })} />
          </Field>
          <Field label="Account number" htmlFor="accountNumber" error={fieldErrors.accountNumber}>
            <input id="accountNumber" className="input" value={values.accountNumber} onChange={(e) => setValues({ ...values, accountNumber: e.target.value })} autoComplete="off" />
          </Field>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Mobile money network" htmlFor="momoNetwork" error={fieldErrors.momoNetwork}>
            <input id="momoNetwork" className="input" placeholder="MTN, Telecel, AirtelTigo" value={values.momoNetwork} onChange={(e) => setValues({ ...values, momoNetwork: e.target.value })} />
          </Field>
          <Field label="Mobile money number" htmlFor="momoNumber" error={fieldErrors.momoNumber}>
            <input id="momoNumber" className="input" value={values.momoNumber} onChange={(e) => setValues({ ...values, momoNumber: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Registered account name" htmlFor="momoAccountName" error={fieldErrors.momoAccountName}>
            <input id="momoAccountName" className="input" value={values.momoAccountName} onChange={(e) => setValues({ ...values, momoAccountName: e.target.value })} />
          </Field>
        </div>
      )}

      <StepActions showBack onBack={onBack} loading={loading} error={error} />
    </form>
  );
}
