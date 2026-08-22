import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const tracker = readFileSync(
  join(process.cwd(), "components", "presence", "PresenceTracker.tsx"),
  "utf8",
);

describe("presence tracker resilience", () => {
  it("stops optional heartbeats after RPC or network failure", () => {
    expect(tracker).toContain("if (error) rpcAvailable = false");
    expect(tracker).toContain("catch {");
    expect(tracker).toContain("rpcAvailable = false");
  });
});
