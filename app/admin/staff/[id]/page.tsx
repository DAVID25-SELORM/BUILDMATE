import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { StaffRoleForm } from "@/components/admin/staff/StaffRoleForm";
import { StaffPermissionOverrides } from "@/components/admin/staff/StaffPermissionOverrides";
import { StaffStatusActions } from "@/components/admin/staff/StaffStatusActions";

type StaffRow = {
  membership_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_key: string;
  department: string | null;
  status: string;
  invitation_id: string | null;
  invitation_status: string | null;
};

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission({ permission: "platform.users.view" });
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: staffRows, error: staffError }, { data: overrides }, { data: auditLog }] = await Promise.all([
    supabase.rpc("admin_list_platform_staff"),
    supabase.from("platform_staff_permission_overrides").select("granted, reason, created_at, platform_permissions(key,label)").eq("membership_id", id),
    supabase.from("membership_audit_log").select("*").eq("target_membership_id", id).order("created_at", { ascending: false })
  ]);

  const staff = ((staffRows ?? []) as StaffRow[]).find((r) => r.membership_id === id);
  if (staffError || !staff) notFound();

  const overrideList = (overrides ?? [])
    .map((o) => ({
      permission: (o.platform_permissions as unknown as { key: string } | null)?.key ?? "",
      granted: o.granted as boolean
    }))
    .filter((o) => o.permission);

  return (
    <DashboardShell title="Platform administration" nav={[...ADMIN_NAV]}>
      <Link href="/admin/staff" className="text-sm font-semibold text-brand-700">← Back to staff</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">{staff.full_name}</h1>
          <p className="mt-1 text-slate-600">{staff.email}{staff.phone ? ` · ${staff.phone}` : ""}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold capitalize">{staff.status}</span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <StaffRoleForm membershipId={staff.membership_id} currentRoleKey={staff.role_key} />
        <StaffStatusActions
          membershipId={staff.membership_id}
          status={staff.status}
          invitationId={staff.invitation_id}
          invitationStatus={staff.invitation_status}
        />
      </div>

      <div className="mt-6">
        <StaffPermissionOverrides membershipId={staff.membership_id} overrides={overrideList} />
      </div>

      <div className="card mt-6 p-5">
        <h2 className="text-lg font-bold">Audit history</h2>
        <div className="mt-4 divide-y">
          {(auditLog ?? []).map((entry) => (
            <div key={entry.id} className="py-3 text-sm">
              <div className="flex justify-between">
                <b className="capitalize">{String(entry.action).replaceAll("_", " ")}</b>
                <span className="text-slate-500">{new Date(entry.created_at).toLocaleString()}</span>
              </div>
              {entry.reason && <p className="mt-1 text-slate-600">{entry.reason}</p>}
            </div>
          ))}
          {!auditLog?.length && <p className="py-3 text-sm text-slate-500">No audit history yet.</p>}
        </div>
      </div>
    </DashboardShell>
  );
}
