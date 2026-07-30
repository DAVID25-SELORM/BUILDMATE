import type { VerificationStatus } from "@/lib/supplier/constants";

const TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "information_required", "approved", "rejected"],
  under_review: ["information_required", "approved", "rejected"],
  information_required: ["submitted"],
  approved: ["suspended"],
  rejected: ["submitted"],
  suspended: ["approved"]
};

export function canTransitionStatus(from: VerificationStatus, to: VerificationStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isEditableStatus(status: VerificationStatus): boolean {
  return status === "draft" || status === "information_required";
}
