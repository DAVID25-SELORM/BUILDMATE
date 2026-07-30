import type { UserRole } from "@/types/database";

export const REGISTERABLE_ROLES = ["customer", "contractor", "supplier", "driver", "professional"] as const;
export type RegisterableRole = (typeof REGISTERABLE_ROLES)[number];

export const ROLE_LABELS: Record<RegisterableRole, string> = {
  customer: "Customer",
  contractor: "Contractor / Company",
  supplier: "Supplier",
  driver: "Driver / Transporter",
  professional: "Professional / Artisan"
};

// Contractor, driver and professional accounts fall back to the shared dashboard
// because no dedicated organisation workspace exists for them yet.
const ROLE_REDIRECTS: Record<UserRole, string> = {
  customer: "/dashboard",
  contractor: "/dashboard",
  driver: "/dashboard",
  professional: "/dashboard",
  supplier: "/supplier",
  admin: "/admin",
  super_admin: "/admin"
};

const DEFAULT_REDIRECT = "/dashboard";

export function getRedirectForRole(role: string | null | undefined): string {
  if (role && role in ROLE_REDIRECTS) {
    return ROLE_REDIRECTS[role as UserRole];
  }
  return DEFAULT_REDIRECT;
}

export function isRegisterableRole(value: string): value is RegisterableRole {
  return (REGISTERABLE_ROLES as readonly string[]).includes(value);
}
