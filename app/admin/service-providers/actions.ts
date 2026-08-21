"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export async function reviewProvider(providerId: string, formData: FormData) {
  await requireRole(["admin", "super_admin"]);
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
  const { error } = await s.rpc("admin_review_service_provider", {
    target_provider: providerId,
    target_status: status,
    target_reason: reason,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/service-providers");
}
