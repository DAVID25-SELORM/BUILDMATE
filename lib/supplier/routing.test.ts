import { describe, expect, it } from "vitest";
import { getOnboardingRouteDecision, getSupplierDashboardDecision } from "./routing";
import { VERIFICATION_STATUSES, type VerificationStatus } from "./constants";

describe("getSupplierDashboardDecision", () => {
  it("sends unfinished applications to onboarding", () => {
    expect(getSupplierDashboardDecision("draft")).toEqual({ action: "redirect_onboarding" });
    expect(getSupplierDashboardDecision("information_required")).toEqual({ action: "redirect_onboarding" });
  });

  it("unlocks the dashboard only when approved", () => {
    expect(getSupplierDashboardDecision("approved")).toEqual({ action: "show_dashboard" });
  });

  it("shows a status screen for every other state", () => {
    for (const status of ["submitted", "under_review", "rejected", "suspended"] as VerificationStatus[]) {
      expect(getSupplierDashboardDecision(status)).toEqual({ action: "show_status" });
    }
  });

  it("covers every verification status without falling through", () => {
    for (const status of VERIFICATION_STATUSES) {
      expect(() => getSupplierDashboardDecision(status)).not.toThrow();
    }
  });
});

describe("getOnboardingRouteDecision", () => {
  it("bounces approved suppliers back to the dashboard", () => {
    expect(getOnboardingRouteDecision("approved")).toEqual({ action: "redirect_dashboard" });
  });

  it("shows the editable wizard for draft and information_required", () => {
    expect(getOnboardingRouteDecision("draft")).toEqual({ action: "show_wizard" });
    expect(getOnboardingRouteDecision("information_required")).toEqual({ action: "show_wizard" });
  });

  it("shows a read-only status screen while submitted, under review, rejected or suspended", () => {
    for (const status of ["submitted", "under_review", "rejected", "suspended"] as VerificationStatus[]) {
      expect(getOnboardingRouteDecision(status)).toEqual({ action: "show_status" });
    }
  });
});
