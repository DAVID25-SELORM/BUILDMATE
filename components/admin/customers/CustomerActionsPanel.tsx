"use client";
import { useActionState } from "react";
import {
  addCustomerNote,
  manageCustomer,
  requestCustomerAccessReset,
  type AdminActionState,
} from "@/app/admin/customers/actions";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmActionButton";
function ActionForm({
  id,
  action,
  label,
}: {
  id: string;
  action: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    manageCustomer.bind(null, id, action),
    null as AdminActionState,
  );
  return (
    <form action={formAction} className="rounded-xl border p-3">
      <label className="label">Reason for {label.toLowerCase()}</label>
      <textarea
        className="input min-h-20"
        name="reason"
        minLength={5}
        required
      />
      <ConfirmSubmitButton className="btn-secondary mt-2" disabled={pending} label={label} pendingLabel={pending ? "Saving…" : undefined} message={`${label}? This action is audited.`} />
      {state?.error && (
        <p className="mt-2 text-sm text-red-600">{state.error}</p>
      )}
      {state?.message && (
        <p className="mt-2 text-sm text-emerald-700">{state.message}</p>
      )}
    </form>
  );
}
export function CustomerActionsPanel({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [noteState, noteAction, notePending] = useActionState(
    addCustomerNote.bind(null, id),
    null as AdminActionState,
  );
  const [resetState, resetAction, resetPending] = useActionState(
    requestCustomerAccessReset.bind(null, id),
    null as AdminActionState,
  );
  return (
    <div className="card space-y-4 p-5">
      <h2 className="text-lg font-bold">Administrative actions</h2>
      {status === "active" && (
        <>
          <ActionForm id={id} action="suspend" label="Suspend account" />
          <ActionForm id={id} action="restrict" label="Restrict purchasing" />
        </>
      )}
      {status !== "active" && (
        <ActionForm id={id} action="reactivate" label="Reactivate account" />
      )}
      <ActionForm id={id} action="deactivate" label="Deactivate account" />
      <form action={resetAction} className="border-t pt-4">
        <label className="label">Password reset reason</label>
        <textarea
          className="input min-h-20"
          name="reason"
          minLength={5}
          required
        />
        <button className="btn-secondary mt-2" disabled={resetPending}>
          {resetPending ? "Requesting…" : "Send password reset"}
        </button>
        {resetState?.error && (
          <p className="text-sm text-red-600">{resetState.error}</p>
        )}
        {resetState?.message && (
          <p className="text-sm text-emerald-700">{resetState.message}</p>
        )}
      </form>
      <form action={noteAction} className="border-t pt-4">
        <label className="label">Internal note</label>
        <textarea className="input min-h-20" name="note" required />
        <button className="btn-secondary mt-2" disabled={notePending}>
          Add note
        </button>
        {noteState?.error && (
          <p className="text-sm text-red-600">{noteState.error}</p>
        )}
        {noteState?.message && (
          <p className="text-sm text-emerald-700">{noteState.message}</p>
        )}
      </form>
    </div>
  );
}
