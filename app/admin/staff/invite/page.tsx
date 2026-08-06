import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { requirePermission } from "@/lib/auth/permissions";
import { InviteStaffForm } from "@/components/admin/staff/InviteStaffForm";

export default async function InviteStaffPage() {
  await requirePermission({ permission: "platform.users.invite" });
  return (
    <DashboardShell title="Platform administration" nav={[...ADMIN_NAV]}>
      <Link href="/admin/staff" className="text-sm font-semibold text-brand-700">← Back to staff</Link>
      <h1 className="mt-3 text-3xl font-black">Invite platform staff</h1>
      <p className="mt-2 text-slate-600">They&apos;ll receive an email with a secure link to accept and set up their account.</p>
      <InviteStaffForm />
    </DashboardShell>
  );
}
