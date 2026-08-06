"use client";

import { useActionState, useState } from "react";
import { inviteStaff, type StaffActionState } from "@/app/admin/staff/actions";
import { PLATFORM_ROLE_KEYS, PLATFORM_ROLE_LABELS, PLATFORM_PERMISSION_KEYS, PLATFORM_PERMISSION_LABELS } from "@/lib/permissions/platform";

export function InviteStaffForm() {
  const [state, action, pending] = useActionState(inviteStaff, null as StaffActionState);
  const [showExtra, setShowExtra] = useState(false);

  return (
    <form action={action} className="card mt-6 space-y-4 p-6">
      <div>
        <label className="label" htmlFor="fullName">Full name</label>
        <input id="fullName" name="fullName" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone number</label>
        <input id="phone" name="phone" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="roleKey">Role</label>
        <select id="roleKey" name="roleKey" className="input" required defaultValue="platform_viewer">
          {PLATFORM_ROLE_KEYS.map((key) => (
            <option key={key} value={key}>{PLATFORM_ROLE_LABELS[key]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="department">Department</label>
        <input id="department" name="department" className="input" />
      </div>
      <div>
        <button type="button" className="text-sm font-semibold text-brand-700" onClick={() => setShowExtra((v) => !v)}>
          {showExtra ? "Hide" : "Add"} additional permissions
        </button>
        {showExtra && (
          <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
            {PLATFORM_PERMISSION_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="extraPermissions" value={key} />
                {PLATFORM_PERMISSION_LABELS[key]}
              </label>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="label" htmlFor="reason">Reason for access</label>
        <textarea id="reason" name="reason" className="input min-h-24" minLength={5} required />
      </div>
      {state?.error && <p className="text-sm font-medium text-red-600" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Sending invitation..." : "Send invitation"}
      </button>
    </form>
  );
}
