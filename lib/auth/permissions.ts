import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getRedirectForRole } from "@/lib/auth/roles";

type PermissionCheck = { permission: string; organisationId?: string };

// UI-visibility only — never the sole gate for a sensitive action. Every
// server action, route handler, and RPC must independently enforce access
// (requirePermission below, or RLS/has_permission inside the RPC itself).
export async function hasPermission(check: PermissionCheck): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_permission", {
    target_permission: check.permission,
    target_organisation: check.organisationId ?? null
  });
  return data === true;
}

export async function requirePermission(check: PermissionCheck) {
  const { user, profile } = await requireUser();
  const allowed = await hasPermission(check);
  if (!allowed) {
    redirect(getRedirectForRole(profile?.role));
  }
  return { user, profile };
}

export async function requirePlatformAccess() {
  const { user, profile } = await requireUser();
  const { data: allowed } = await (await createClient()).rpc("has_platform_access");
  if (!allowed) redirect(getRedirectForRole(profile?.role));
  return { user, profile };
}
