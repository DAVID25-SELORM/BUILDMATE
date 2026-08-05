import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PermissionControl } from "@/components/admin/settings/PermissionControl";
const SCOPES = [
  "operations",
  "supplier_verification",
  "customer_support",
  "finance",
  "catalogue",
  "logistics",
  "reports",
  "audit",
  "settings",
  "viewer",
];
export default async function Settings() {
  const { profile } = await requireRole(["admin", "super_admin"]),
    s = await createClient();
  const [{ data: admins,error:adminsError }, { data: permissions,error:permissionsError }] = await Promise.all([
    s
      .from("profiles")
      .select("id,full_name,role,account_status")
      .in("role", ["admin", "super_admin"])
      .order("full_name"),
    s.from("admin_permissions").select("admin_id,permission"),
  ]);
  const canEdit = profile?.role === "super_admin";
  return (
    <DashboardShell title="Platform administration" nav={[...ADMIN_NAV]}>
      <h1 className="text-3xl font-black">System settings</h1>
      <p className="mt-2 text-slate-600">
        Scoped administrator access. Permission changes require a super
        administrator and are audited.
      </p>
      {!canEdit && (
        <div className="mt-5 rounded-xl bg-amber-50 p-4 text-amber-900">
          Your access is read-only. Only a super administrator can change
          scopes.
        </div>
      )}
      {(adminsError||permissionsError)&&<div className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">Unable to load administrator permissions: {(adminsError??permissionsError)?.message}</div>}
      <div className="mt-6 space-y-4">
        {(admins ?? []).map((a) => {
          const granted = new Set(
            permissions
              ?.filter((p) => p.admin_id === a.id)
              .map((p) => p.permission),
          );
          return (
            <section className="card p-5" key={a.id}>
              <div className="flex justify-between">
                <b>{a.full_name}</b>
                <span className="capitalize">
                  {a.role.replaceAll("_", " ")} · {a.account_status}
                </span>
              </div>
              {a.role === "super_admin" ? (
                <p className="mt-3 text-sm text-slate-600">
                  Super administrators inherit every scope.
                </p>
              ) : canEdit ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {SCOPES.map((scope) => (
                    <PermissionControl
                      key={scope}
                      adminId={a.id}
                      permission={scope}
                      granted={granted.has(scope)}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  {[...granted].join(", ") || "No explicit permissions"}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </DashboardShell>
  );
}
