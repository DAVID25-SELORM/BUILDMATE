"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { generateInvitationToken } from "@/lib/invitations/token";
import { invitePlatformStaffSchema } from "@/lib/invitations/validation";
import { PLATFORM_ROLE_LABELS, type PlatformRoleKey } from "@/lib/permissions/platform";
import { sendNotification } from "@/lib/notifications/sender";

export type StaffActionState = { error?: string; message?: string } | null;

function inviteUrlFor(token: string) {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://buildmate-six.vercel.app";
  return `${origin}/invite/${token}`;
}

async function sendInvitationEmail(email: string, fullName: string, roleKey: string, token: string) {
  await sendNotification({
    channel: "email",
    template_key: "staff_invitation",
    payload: {
      fullName,
      roleLabel: PLATFORM_ROLE_LABELS[roleKey as PlatformRoleKey] ?? roleKey,
      inviteUrl: inviteUrlFor(token)
    },
    recipient_email: email,
    recipient_phone: null
  });
}

export async function inviteStaff(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  await requirePermission({ permission: "platform.users.invite" });

  const result = invitePlatformStaffSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    roleKey: formData.get("roleKey"),
    department: formData.get("department"),
    extraPermissions: formData.getAll("extraPermissions"),
    reason: formData.get("reason")
  });
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? "Check the form and try again" };
  }

  const { token, tokenHash } = generateInvitationToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_platform_staff", {
    target_email: result.data.email,
    target_full_name: result.data.fullName,
    target_phone: result.data.phone || null,
    target_role_key: result.data.roleKey,
    target_department: result.data.department || null,
    target_extra_permissions: result.data.extraPermissions,
    target_token_hash: tokenHash,
    target_reason: result.data.reason
  });
  if (error) return { error: error.message };

  try {
    await sendInvitationEmail(result.data.email, result.data.fullName, result.data.roleKey, token);
  } catch {
    revalidatePath("/admin/staff");
    redirect("/admin/staff?notice=invite_email_failed");
  }

  revalidatePath("/admin/staff");
  redirect("/admin/staff");
}

export async function resendInvite(invitationId: string, _prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  await requirePermission({ permission: "platform.users.invite" });
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Provide a reason of at least 5 characters" };

  const supabase = await createClient();
  const { data: invitation, error: fetchError } = await supabase
    .from("invitations")
    .select("email, full_name, role_key")
    .eq("id", invitationId)
    .single();
  if (fetchError || !invitation) return { error: "Invitation not found" };

  const { token, tokenHash } = generateInvitationToken();
  const { error } = await supabase.rpc("resend_invitation", {
    target_invitation: invitationId,
    target_token_hash: tokenHash,
    target_reason: reason
  });
  if (error) return { error: error.message };

  try {
    await sendInvitationEmail(invitation.email, invitation.full_name, invitation.role_key, token);
  } catch {
    return { message: "Invitation refreshed, but the email could not be sent. Try Resend again." };
  }

  revalidatePath("/admin/staff");
  return { message: "Invitation resent" };
}

export async function revokeInvite(invitationId: string, _prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  await requirePermission({ permission: "platform.users.manage_roles" });
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Provide a reason of at least 5 characters" };
  const { error } = await (await createClient()).rpc("revoke_invitation", {
    target_invitation: invitationId,
    target_reason: reason
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/staff");
  return { message: "Invitation revoked" };
}

export async function setStaffRole(membershipId: string, _prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  await requirePermission({ permission: "platform.users.manage_roles" });
  const roleKey = String(formData.get("roleKey") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!roleKey) return { error: "Choose a role" };
  if (reason.length < 5) return { error: "Provide a reason of at least 5 characters" };
  const { error } = await (await createClient()).rpc("set_platform_staff_role", {
    target_membership: membershipId,
    target_role_key: roleKey,
    target_reason: reason
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/staff/${membershipId}`);
  revalidatePath("/admin/staff");
  return { message: "Role updated" };
}

export async function setStaffPermissionOverride(
  membershipId: string,
  permissionKey: string,
  grant: boolean,
  _prev: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  await requirePermission({ permission: "platform.users.manage_roles" });
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Provide a reason of at least 5 characters" };
  const { error } = await (await createClient()).rpc("set_platform_staff_permission_override", {
    target_membership: membershipId,
    target_permission_key: permissionKey,
    should_grant: grant,
    target_reason: reason
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/staff/${membershipId}`);
  return { message: grant ? "Permission granted" : "Permission revoked" };
}

async function membershipStatusAction(
  rpcName: "suspend_platform_staff" | "reactivate_platform_staff" | "remove_platform_staff",
  membershipId: string,
  formData: FormData,
  successMessage: string
): Promise<StaffActionState> {
  await requirePermission({ permission: "platform.users.manage_roles" });
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Provide a reason of at least 5 characters" };
  const { error } = await (await createClient()).rpc(rpcName, {
    target_membership: membershipId,
    target_reason: reason
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/staff/${membershipId}`);
  revalidatePath("/admin/staff");
  return { message: successMessage };
}

export async function suspendStaff(membershipId: string, _prev: StaffActionState, formData: FormData) {
  return membershipStatusAction("suspend_platform_staff", membershipId, formData, "Staff member suspended");
}
export async function reactivateStaff(membershipId: string, _prev: StaffActionState, formData: FormData) {
  return membershipStatusAction("reactivate_platform_staff", membershipId, formData, "Staff member reactivated");
}
export async function removeStaff(membershipId: string, _prev: StaffActionState, formData: FormData) {
  return membershipStatusAction("remove_platform_staff", membershipId, formData, "Staff member removed");
}
