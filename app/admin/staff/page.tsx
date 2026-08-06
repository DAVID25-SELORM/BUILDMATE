import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import {
  PLATFORM_ROLE_KEYS,
  PLATFORM_ROLE_LABELS,
  MEMBERSHIP_STATUS_LABELS,
  INVITATION_STATUS_LABELS
} from "@/lib/permissions/platform";

type StaffRow = {
  membership_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role_key: string;
  role_label: string;
  department: string | null;
  status: string;
  invited_at: string;
  joined_at: string | null;
  suspended_at: string | null;
  removed_at: string | null;
  invitation_id: string | null;
  invitation_status: string | null;
  invitation_expires_at: string | null;
};

export default async function StaffPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePermission({ permission: "platform.users.view" });
  const q = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_platform_staff");
  let rows = (data ?? []) as StaffRow[];

  if (q.role) rows = rows.filter((r) => r.role_key === q.role);
  if (q.department) rows = rows.filter((r) => (r.department ?? "").toLowerCase().includes(q.department!.toLowerCase()));
  if (q.status) rows = rows.filter((r) => r.status === q.status);
  if (q.invitation) rows = rows.filter((r) => r.invitation_status === q.invitation);

  return (
    <DashboardShell title="Platform administration" nav={[...ADMIN_NAV]}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">Platform staff</h1>
          <p className="mt-2 text-slate-600">BuildMate&apos;s internal team, invitations and access.</p>
        </div>
        <Link href="/admin/staff/invite" className="btn-primary">Invite staff</Link>
      </div>

      {q.notice === "invite_email_failed" && (
        <div className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-900">
          The invitation was created, but the email could not be sent. Open the record below and use Resend.
        </div>
      )}

      <form className="card mt-6 grid gap-3 p-4 md:grid-cols-4">
        <select className="input" name="role" defaultValue={q.role}>
          <option value="">All roles</option>
          {PLATFORM_ROLE_KEYS.map((key) => (
            <option key={key} value={key}>{PLATFORM_ROLE_LABELS[key]}</option>
          ))}
        </select>
        <input className="input" name="department" defaultValue={q.department} placeholder="Department" />
        <select className="input" name="status" defaultValue={q.status}>
          <option value="">All statuses</option>
          {Object.entries(MEMBERSHIP_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select className="input" name="invitation" defaultValue={q.invitation}>
          <option value="">All invitation statuses</option>
          {Object.entries(INVITATION_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button className="btn-primary md:col-span-4">Apply filters</button>
      </form>

      {error && (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">Unable to load staff: {error.message}</div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Invitation</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr className="border-b last:border-0" key={r.membership_id}>
                <td className="p-4">
                  <b>{r.full_name}</b>
                  <p className="text-xs text-slate-500">{r.email}{r.phone ? ` · ${r.phone}` : ""}</p>
                </td>
                <td>{r.role_label}</td>
                <td>{r.department ?? "—"}</td>
                <td className="capitalize">{r.status}</td>
                <td className="capitalize">{r.invitation_status ?? "—"}</td>
                <td>
                  <Link className="font-semibold text-brand-700" href={`/admin/staff/${r.membership_id}`}>Open</Link>
                </td>
              </tr>
            ))}
            {!rows.length && !error && (
              <tr>
                <td className="p-8 text-center text-slate-500" colSpan={6}>No platform staff match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
