"use client";
import { useActionState } from "react";
import {
  changeSettlementHold,
  manageSupplierControl,
  type SupplierAdminState,
} from "@/app/admin/suppliers/actions";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmActionButton";
function Form({
  id,
  action,
  label,
  confirmText,
}: {
  id: string;
  action: string;
  label: string;
  confirmText: string;
}) {
  const [state, submit, pending] = useActionState(
    manageSupplierControl.bind(null, id, action),
    null as SupplierAdminState,
  );
  return (
    <form action={submit} className="rounded-xl border p-3">
      <label className="label">{label} reason</label>
      <textarea
        className="input min-h-16"
        name="reason"
        minLength={5}
        required
      />
      <ConfirmSubmitButton className="btn-secondary mt-2" disabled={pending} label={label} pendingLabel={pending ? "Saving…" : undefined} message={confirmText} />
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="mt-2 text-sm text-emerald-700">{state.message}</p>
      )}
    </form>
  );
}
function HoldForm({ id, hold }: { id: string; hold: boolean }) {
  const [state, submit, pending] = useActionState(
    changeSettlementHold.bind(null, id, hold),
    null as SupplierAdminState,
  );
  const label = hold ? "Hold settlements" : "Release settlement hold";
  return (
    <form action={submit} className="rounded-xl border border-amber-200 p-3">
      <label className="label">{label} reason</label>
      <textarea
        className="input min-h-16"
        name="reason"
        minLength={5}
        required
      />
      <ConfirmSubmitButton className="btn-secondary mt-2" disabled={pending} label={label} pendingLabel={pending ? "Saving…" : undefined} message={`${label}? This finance action is audited.`} />
      {state?.error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state?.message && (
        <p className="mt-2 text-sm text-emerald-700">{state.message}</p>
      )}
    </form>
  );
}
export function SupplierTradingControls({
  id,
  accountStatus,
  publishing,
  orders,
  settlementHold,
}: {
  id: string;
  accountStatus: string;
  publishing: boolean;
  orders: boolean;
  settlementHold: boolean;
}) {
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-bold">Trading and finance controls</h2>
      <p className="text-xs text-slate-500">
        Every change requires a reason and is enforced server-side. Settlement
        controls require finance permission.
      </p>
      <Form
        id={id}
        action={accountStatus === "suspended" ? "reactivate" : "suspend"}
        label={
          accountStatus === "suspended"
            ? "Reactivate supplier"
            : "Suspend supplier"
        }
        confirmText={
          accountStatus === "suspended"
            ? "Reactivate this supplier?"
            : "Suspend this supplier?"
        }
      />
      <Form
        id={id}
        action={publishing ? "disable_publishing" : "enable_publishing"}
        label={
          publishing
            ? "Disable product publishing"
            : "Enable product publishing"
        }
        confirmText="Change product publishing access?"
      />
      <Form
        id={id}
        action={orders ? "disable_orders" : "enable_orders"}
        label={orders ? "Disable order acceptance" : "Enable order acceptance"}
        confirmText="Change order acceptance access?"
      />
      <HoldForm id={id} hold={!settlementHold} />
    </section>
  );
}
