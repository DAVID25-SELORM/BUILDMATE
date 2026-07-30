import { z } from "zod";
import { REGISTERABLE_ROLES } from "@/lib/auth/roles";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required")
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name"),
    phone: z.string().trim().min(7, "Enter a valid phone number"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    role: z.enum(REGISTERABLE_ROLES),
    businessName: z.string().trim().optional().default(""),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password")
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
    }
    if (data.role === "supplier" && data.businessName.length === 0) {
      ctx.addIssue({ code: "custom", path: ["businessName"], message: "Business name is required for supplier accounts" });
    }
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address")
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
