"use client";
import { useActionState } from "react";
import {
  setAdminPermission,
  type PermissionState,
} from "@/app/admin/settings/actions";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmActionButton";
export function PermissionControl({
  adminId,
  permission,
  granted,
}: {
  adminId: string;
  permission: string;
  granted: boolean;
}) {
  const [state, action, pending] = useActionState(
    setAdminPermission.bind(null, adminId, permission, !granted),
    null as PermissionState,
  );
  return (
    <form action={action} className="rounded-lg border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm capitalize">
          {permission.replaceAll("_", " ")}
        </span>
        <ConfirmSubmitButton className={granted ? "text-sm font-semibold text-red-700" : "text-sm font-semibold text-brand-700"} disabled={pending} label={granted ? "Revoke" : "Grant"} pendingLabel={pending ? "Saving…" : undefined} message={`${granted ? "Revoke" : "Grant"} ${permission.replaceAll("_", " ")} permission?`} />
      </div>
      <input
        className="input mt-2 text-sm"
        name="reason"
        minLength={5}
        required
        placeholder="Required audit reason"
      />
      {state?.error && (
        <p className="mt-1 text-xs text-red-600">{state.error}</p>
      )}
      {state?.message && (
        <p className="mt-1 text-xs text-emerald-700">{state.message}</p>
      )}
    </form>
  );
}
