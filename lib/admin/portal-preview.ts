import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type PortalPreviewSession = {
  id: string;
  portal_type: "customer" | "supplier";
  target_user_id: string | null;
  target_organisation_id: string | null;
  reason: string;
  reference_number: string | null;
  expires_at: string;
};

export async function requirePortalPreview(
  portalType: "customer" | "supplier",
  targetId: string,
  route: string,
) {
  const { user } = await requireRole(["admin", "super_admin"]);
  const sessionId = (await cookies()).get("admin_portal_preview")?.value;
  if (!sessionId) redirect("/admin?preview=missing");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_portal_preview_sessions")
    .select("id,admin_user_id,portal_type,target_user_id,target_organisation_id,reason,reference_number,expires_at,status")
    .eq("id", sessionId)
    .eq("admin_user_id", user.id)
    .eq("portal_type", portalType)
    .eq(portalType === "customer" ? "target_user_id" : "target_organisation_id", targetId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) redirect("/admin?preview=invalid_or_expired");
  const session = data as unknown as PortalPreviewSession;
  const logged = await supabase.rpc("log_admin_portal_preview_access", {
    target_session: session.id,
    target_route: route,
    target_action: "preview_page_opened",
  });
  if (logged.error) redirect("/admin?preview=invalid_or_expired");
  return { supabase, session };
}
