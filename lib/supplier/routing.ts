import type { VerificationStatus } from "@/lib/supplier/constants";

export type SupplierRouteDecision =
  | { action: "redirect_onboarding" }
  | { action: "show_status" }
  | { action: "show_dashboard" };

// Decides what /supplier should render for a given verification status.
// Onboarding itself uses isEditableStatus (draft/information_required) to
// decide whether the wizard forms are writable; this governs the dashboard.
export function getSupplierDashboardDecision(status: VerificationStatus): SupplierRouteDecision {
  if (status === "draft" || status === "information_required") {
    return { action: "redirect_onboarding" };
  }
  if (status === "approved") {
    return { action: "show_dashboard" };
  }
  return { action: "show_status" };
}

// Decides what /supplier/onboarding should render for a given verification status.
export type OnboardingRouteDecision =
  | { action: "redirect_dashboard" }
  | { action: "show_status" }
  | { action: "show_wizard" };

export function getOnboardingRouteDecision(status: VerificationStatus): OnboardingRouteDecision {
  if (status === "approved") {
    return { action: "redirect_dashboard" };
  }
  if (status === "draft" || status === "information_required") {
    return { action: "show_wizard" };
  }
  return { action: "show_status" };
}
