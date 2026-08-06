import { describe, expect, it } from "vitest";
import { canTransitionInvitation, canTransitionMembership, isInvitationActionable } from "./status";

describe("canTransitionInvitation", () => {
  it("allows pending to move to accepted, expired, or revoked", () => {
    expect(canTransitionInvitation("pending", "accepted")).toBe(true);
    expect(canTransitionInvitation("pending", "expired")).toBe(true);
    expect(canTransitionInvitation("pending", "revoked")).toBe(true);
  });

  it("blocks transitions out of terminal states", () => {
    expect(canTransitionInvitation("accepted", "pending")).toBe(false);
    expect(canTransitionInvitation("expired", "pending")).toBe(false);
    expect(canTransitionInvitation("revoked", "pending")).toBe(false);
  });
});

describe("isInvitationActionable", () => {
  it("is actionable only when pending and not past expiry", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isInvitationActionable("pending", future)).toBe(true);
    expect(isInvitationActionable("pending", past)).toBe(false);
    expect(isInvitationActionable("accepted", future)).toBe(false);
  });
});

describe("canTransitionMembership", () => {
  it("allows invited to become active or removed", () => {
    expect(canTransitionMembership("invited", "active")).toBe(true);
    expect(canTransitionMembership("invited", "removed")).toBe(true);
    expect(canTransitionMembership("invited", "suspended")).toBe(false);
  });

  it("allows active to suspend or be removed", () => {
    expect(canTransitionMembership("active", "suspended")).toBe(true);
    expect(canTransitionMembership("active", "removed")).toBe(true);
  });

  it("allows suspended to reactivate or be removed", () => {
    expect(canTransitionMembership("suspended", "active")).toBe(true);
    expect(canTransitionMembership("suspended", "removed")).toBe(true);
  });

  it("blocks any transition out of removed", () => {
    expect(canTransitionMembership("removed", "active")).toBe(false);
    expect(canTransitionMembership("removed", "invited")).toBe(false);
  });
});
