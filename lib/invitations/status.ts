export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";
export type MembershipStatus = "invited" | "active" | "suspended" | "removed";

const INVITATION_TRANSITIONS: Record<InvitationStatus, InvitationStatus[]> = {
  pending: ["accepted", "expired", "revoked"],
  accepted: [],
  expired: [],
  revoked: []
};

export function canTransitionInvitation(from: InvitationStatus, to: InvitationStatus): boolean {
  return INVITATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isInvitationActionable(status: InvitationStatus, expiresAt: string | Date): boolean {
  if (status !== "pending") return false;
  return new Date(expiresAt).getTime() > Date.now();
}

const MEMBERSHIP_TRANSITIONS: Record<MembershipStatus, MembershipStatus[]> = {
  invited: ["active", "removed"],
  active: ["suspended", "removed"],
  suspended: ["active", "removed"],
  removed: []
};

export function canTransitionMembership(from: MembershipStatus, to: MembershipStatus): boolean {
  return MEMBERSHIP_TRANSITIONS[from]?.includes(to) ?? false;
}
