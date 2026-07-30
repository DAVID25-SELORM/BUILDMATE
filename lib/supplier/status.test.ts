import { describe, expect, it } from "vitest";
import { canTransitionStatus, isEditableStatus } from "./status";
import { VERIFICATION_STATUSES, type VerificationStatus } from "./constants";

describe("canTransitionStatus", () => {
  it("allows submitting a draft application", () => {
    expect(canTransitionStatus("draft", "submitted")).toBe(true);
  });

  it("allows the standard review path", () => {
    expect(canTransitionStatus("submitted", "under_review")).toBe(true);
    expect(canTransitionStatus("under_review", "approved")).toBe(true);
    expect(canTransitionStatus("under_review", "rejected")).toBe(true);
    expect(canTransitionStatus("under_review", "information_required")).toBe(true);
  });

  it("allows resubmission after information is requested or rejected", () => {
    expect(canTransitionStatus("information_required", "submitted")).toBe(true);
    expect(canTransitionStatus("rejected", "submitted")).toBe(true);
  });

  it("allows suspending an approved supplier and reinstating them", () => {
    expect(canTransitionStatus("approved", "suspended")).toBe(true);
    expect(canTransitionStatus("suspended", "approved")).toBe(true);
  });

  it("rejects skipping straight from draft to approved", () => {
    expect(canTransitionStatus("draft", "approved")).toBe(false);
  });

  it("rejects suspending a supplier that was never approved", () => {
    expect(canTransitionStatus("draft", "suspended")).toBe(false);
    expect(canTransitionStatus("submitted", "suspended")).toBe(false);
  });

  it("rejects moving into draft from any state", () => {
    for (const status of VERIFICATION_STATUSES as readonly VerificationStatus[]) {
      expect(canTransitionStatus(status, "draft")).toBe(false);
    }
  });
});

describe("isEditableStatus", () => {
  it("treats draft and information_required as editable", () => {
    expect(isEditableStatus("draft")).toBe(true);
    expect(isEditableStatus("information_required")).toBe(true);
  });

  it("treats every other status as locked", () => {
    expect(isEditableStatus("submitted")).toBe(false);
    expect(isEditableStatus("under_review")).toBe(false);
    expect(isEditableStatus("approved")).toBe(false);
    expect(isEditableStatus("rejected")).toBe(false);
    expect(isEditableStatus("suspended")).toBe(false);
  });
});
