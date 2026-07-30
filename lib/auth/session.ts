import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRedirectForRole } from "@/lib/auth/roles";
import type { UserRole } from "@/types/database";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  return { user, profile };
}

export async function requireRole(allowedRoles: UserRole[]) {
  const { user, profile } = await requireUser();

  if (!profile || !allowedRoles.includes(profile.role as UserRole)) {
    redirect(getRedirectForRole(profile?.role));
  }

  return { user, profile };
}
