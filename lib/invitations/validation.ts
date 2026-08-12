import { z } from "zod";
import { PLATFORM_ROLE_KEYS } from "@/lib/permissions/platform";
import { PLATFORM_ACCESS_REASONS, PLATFORM_DEPARTMENTS } from "@/lib/invitations/platform-options";

export const invitePlatformStaffSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the person's full name"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  phone: z.string().trim().optional().default(""),
  roleKey: z.enum(PLATFORM_ROLE_KEYS),
  department: z.enum(PLATFORM_DEPARTMENTS),
  extraPermissions: z.array(z.string()).optional().default([]),
  reason: z.enum(PLATFORM_ACCESS_REASONS)
});
export type InvitePlatformStaffInput = z.infer<typeof invitePlatformStaffSchema>;

export const reasonSchema = z.object({
  reason: z.string().trim().min(5, "Provide a reason of at least 5 characters")
});
