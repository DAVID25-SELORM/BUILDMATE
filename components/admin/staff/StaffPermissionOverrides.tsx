"use client";

import { useActionState } from "react";
import { setStaffPermissionOverride, type StaffActionState } from "@/app/admin/staff/actions";
import { PLATFORM_PERMISSION_KEYS, PLATFORM_PERMISSION_LABELS, type PlatformPermissionKey } from "@/lib/permissions/platform";

function OverrideRow({
  membershipId,
  permission,
  granted
}: {
  membershipId: string;
  permission: PlatformPermissionKey;
  granted: boolean | null;
}) {
  const [state, action, pending] = useActionState(
    setStaffPermissionOverride.bind(null, membershipId, permission, !granted),
    null as StaffActionState
  );
  return (
    <form action={action} className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">{PLATFORM_PERMISSION_LABELS[permission]}</span>
        <span className="text-xs font-semibold">
          {granted === null ? "Role default" : granted ? "Granted (override)" : "Revoked (override)"}
        </span>
      </div>
      <input className="input mt-2 text-sm" name="reason" minLength={5} required placeholder="Required audit reason" />
      <button className="btn-secondary mt-2 text-sm" disabled={pending}>
        {pending ? "Saving…" : granted ? "Revoke override" : "Grant override"}
      </button>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state?.message && <p className="mt-1 text-xs text-emerald-700">{state.message}</p>}
    </form>
  );
}

export function StaffPermissionOverrides({
  membershipId,
  overrides
}: {
  membershipId: string;
  overrides: { permission: string; granted: boolean }[];
}) {
  const overrideMap = new Map(overrides.map((o) => [o.permission, o.granted]));
  return (
    <div className="card p-5">
      <h2 className="text-lg font-bold">Permission overrides</h2>
      <p className="mt-2 text-sm text-slate-600">
        Grants beyond the role&apos;s defaults, or explicit revokes. You cannot grant a permission you do not hold yourself.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {PLATFORM_PERMISSION_KEYS.map((key) => (
          <OverrideRow
            key={key}
            membershipId={membershipId}
            permission={key}
            granted={overrideMap.has(key) ? overrideMap.get(key)! : null}
          />
        ))}
      </div>
    </div>
  );
}
