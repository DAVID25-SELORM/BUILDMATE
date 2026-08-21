import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireUser } from "@/lib/auth/session";
import { getCustomerOrganisationMembership } from "@/lib/organisations/access";
import { customerNavigation } from "@/lib/organisations/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerAccountPage() {
  const { user } = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, { membership }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,phone,role,created_at")
      .eq("id", user.id)
      .maybeSingle(),
    getCustomerOrganisationMembership(),
  ]);
  return (
    <DashboardShell
      title="Customer workspace"
      nav={await customerNavigation(membership?.organisation_id)}
    >
      <h1 className="text-3xl font-black">Account</h1>
      <p className="mt-2 text-slate-600">
        Review your BuildMate identity and account context.
      </p>
      <div className="card mt-6 max-w-2xl divide-y">
        <AccountRow label="Name" value={profile?.full_name ?? "Not set"} />
        <AccountRow label="Email" value={user.email ?? "Not set"} />
        <AccountRow label="Phone" value={profile?.phone ?? "Not set"} />
        <AccountRow
          label="Account type"
          value={(profile?.role ?? "customer").replaceAll("_", " ")}
        />
      </div>
    </DashboardShell>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 p-4 sm:grid-cols-[160px_1fr]">
      <b>{label}</b>
      <span className="capitalize text-slate-600">{value}</span>
    </div>
  );
}
