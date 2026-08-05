"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VerificationLevel } from "@/lib/supplier/constants";

type ActionResult = { success: true } | { success: false; error: string };

function refresh(organisationId: string) {
  revalidatePath(`/admin/suppliers/${organisationId}`);
  revalidatePath("/admin/suppliers");
  revalidatePath("/admin");
}

async function callStatusRpc(
  organisationId: string,
  newStatus: string,
  reason?: string,
  verificationLevels?: VerificationLevel[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_supplier_status", {
    target_org: organisationId,
    new_status: newStatus,
    reason: reason ?? null,
    new_verification_levels: verificationLevels ?? null
  });
  if (error) return { success: false, error: error.message };
  refresh(organisationId);
  return { success: true };
}

export async function startReview(organisationId: string): Promise<ActionResult> {
  return callStatusRpc(organisationId, "under_review");
}

export async function approveSupplier(organisationId: string, verificationLevels: VerificationLevel[], reason: string): Promise<ActionResult> {
  if (reason.trim().length < 5) return { success: false, error: "An approval reason is required" };
  return callStatusRpc(organisationId, "approved", reason, verificationLevels);
}

export async function rejectSupplier(organisationId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { success: false, error: "A rejection reason is required" };
  return callStatusRpc(organisationId, "rejected", reason);
}

export async function requestInformation(organisationId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { success: false, error: "Explain what information is needed" };
  return callStatusRpc(organisationId, "information_required", reason);
}

export async function suspendSupplier(organisationId: string, reason: string): Promise<ActionResult> {
  if (!reason.trim()) return { success: false, error: "A suspension reason is required" };
  return callStatusRpc(organisationId, "suspended", reason);
}

export async function reinstateSupplier(organisationId: string, reason: string): Promise<ActionResult> {
  if (reason.trim().length < 5) return { success: false, error: "A reinstatement reason is required" };
  return callStatusRpc(organisationId, "approved", reason);
}

export async function assignReviewer(organisationId: string, reviewerId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_supplier_reviewer", { target_org: organisationId, reviewer: reviewerId });
  if (error) return { success: false, error: error.message };
  refresh(organisationId);
  return { success: true };
}

export async function addReviewNote(organisationId: string, note: string): Promise<ActionResult> {
  if (!note.trim()) return { success: false, error: "Note cannot be empty" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_supplier_review_note", { target_org: organisationId, note_text: note });
  if (error) return { success: false, error: error.message };
  refresh(organisationId);
  return { success: true };
}

export async function getAdminDocumentSignedUrl(storagePath: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("supplier-documents").createSignedUrl(storagePath, 60);
  if (error || !data) return { error: error?.message ?? "Unable to generate a link" };
  return { url: data.signedUrl };
}
