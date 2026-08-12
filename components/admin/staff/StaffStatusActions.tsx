"use client";

import { useActionState } from "react";
import {
  suspendStaff,
  reactivateStaff,
  removeStaff,
  resendInvite,
  revokeInvite,
  type StaffActionState,
} from "@/app/admin/staff/actions";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmActionButton";

function ActionForm({
  action,
  label,
  confirmMessage,
}: {
  action: (
    prev: StaffActionState,
    formData: FormData,
  ) => Promise<StaffActionState>;
  label: string;
  confirmMessage: string;
}) {
  const [state, boundAction, pending] = useActionState(
    action,
    null as StaffActionState,
  );
  return (
    <form action={boundAction} className="rounded-lg border p-3">
      <input
        className="input text-sm"
        name="reason"
        minLength={5}
        required
        placeholder="Required audit reason"
      />
      <ConfirmSubmitButton className="btn-secondary mt-2 text-sm" disabled={pending} label={label} pendingLabel={pending ? "Working…" : undefined} message={confirmMessage} />
      {state?.error && (
        <p className="mt-1 text-xs text-red-600">{state.error}</p>
      )}
      {state?.message && (
        <p className="mt-1 text-xs text-emerald-700">{state.message}</p>
      )}
    </form>
  );
}

export function StaffStatusActions({
  membershipId,
  status,
  invitationId,
  invitationStatus,
}: {
  membershipId: string;
  status: string;
  invitationId: string | null;
  invitationStatus: string | null;
}) {
  return (
    <div className="card p-5">
      <h2 className="text-lg font-bold">Actions</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {status === "active" && (
          <ActionForm
            action={suspendStaff.bind(null, membershipId)}
            label="Suspend"
            confirmMessage="Suspend this staff member?"
          />
        )}
        {status === "suspended" && (
          <ActionForm
            action={reactivateStaff.bind(null, membershipId)}
            label="Reactivate"
            confirmMessage="Reactivate this staff member?"
          />
        )}
        {(status === "active" ||
          status === "suspended" ||
          status === "invited") && (
          <ActionForm
            action={removeStaff.bind(null, membershipId)}
            label="Remove"
            confirmMessage="Remove this staff member? This cannot be undone."
          />
        )}
        {status === "invited" &&
          invitationId &&
          invitationStatus === "pending" && (
            <>
              <ActionForm
                action={resendInvite.bind(null, invitationId)}
                label="Resend invitation"
                confirmMessage="Resend the invitation email?"
              />
              <ActionForm
                action={revokeInvite.bind(null, invitationId)}
                label="Revoke invitation"
                confirmMessage="Revoke this invitation?"
              />
            </>
          )}
      </div>
    </div>
  );
}
