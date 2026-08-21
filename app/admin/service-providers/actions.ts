"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export async function reviewProvider(providerId: string, formData: FormData) {
  const { user } = await requireRole(["admin", "super_admin"]);
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (
    !["approved", "information_required", "rejected", "suspended"].includes(
      status,
    ) ||
    reason.length < 5
  )
    throw new Error("Choose a decision and provide a detailed reason");
  const s = await createClient();
  const { data: before } = await s
    .from("service_provider_profiles")
    .select("verification_status,account_status,user_id")
    .eq("id", providerId)
    .maybeSingle();
  if (!before) throw new Error("Provider not found");
  const { error } = await s
    .from("service_provider_profiles")
    .update({
      verification_status: status,
      account_status: status === "suspended" ? "suspended" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", providerId);
  if (error) throw new Error(error.message);
  await s
    .from("audit_logs")
    .insert({
      actor_id: user.id,
      entity_type: "service_provider",
      entity_id: providerId,
      action: "SERVICE_PROVIDER_REVIEWED",
      before_data: before,
      after_data: { status, reason },
    });
  await s.rpc("enqueue_user_notification", {
    target_user: before.user_id,
    target_template: "service_provider_reviewed",
    target_payload: { provider_id: providerId, status, reason },
  });
  revalidatePath("/admin/service-providers");
}
