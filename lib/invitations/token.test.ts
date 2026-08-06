import { describe, expect, it } from "vitest";
import { generateInvitationToken, hashInvitationToken } from "./token";

describe("generateInvitationToken", () => {
  it("produces a 64-character hex token", () => {
    const { token } = generateInvitationToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a deterministic sha256 hash of the token", () => {
    const { token, tokenHash } = generateInvitationToken();
    expect(tokenHash).toBe(hashInvitationToken(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates different tokens on each call", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("hashInvitationToken", () => {
  it("never returns the raw token unchanged", () => {
    const token = "a".repeat(64);
    expect(hashInvitationToken(token)).not.toBe(token);
  });

  it("is deterministic for the same input", () => {
    const token = "deadbeef".repeat(8);
    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
  });
});
