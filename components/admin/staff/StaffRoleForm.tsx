"use client";

import { useActionState } from "react";
import { setStaffRole, type StaffActionState } from "@/app/admin/staff/actions";
import { PLATFORM_ROLE_KEYS, PLATFORM_ROLE_LABELS } from "@/lib/permissions/platform";

export function StaffRoleForm({ membershipId, currentRoleKey }: { membershipId: string; currentRoleKey: string }) {
  const [state, action, pending] = useActionState(setStaffRole.bind(null, membershipId), null as StaffActionState);
  return (
    <form action={action} className="card p-5">
      <h2 className="text-lg font-bold">Role</h2>
      <select name="roleKey" className="input mt-3" defaultValue={currentRoleKey}>
        {PLATFORM_ROLE_KEYS.map((key) => (
          <option key={key} value={key}>{PLATFORM_ROLE_LABELS[key]}</option>
        ))}
      </select>
      <input className="input mt-3" name="reason" minLength={5} required placeholder="Required audit reason" />
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.message && <p className="mt-2 text-sm text-emerald-700">{state.message}</p>}
      <button className="btn-primary mt-3" disabled={pending}>{pending ? "Saving…" : "Update role"}</button>
    </form>
  );
}
