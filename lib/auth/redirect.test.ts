import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

describe("getSafeRedirectPath", () => {
  it("keeps local paths, queries, and fragments", () => {
    expect(getSafeRedirectPath("/dashboard?tab=orders#latest", "/dashboard")).toBe(
      "/dashboard?tab=orders#latest"
    );
  });

  it.each([null, "", "dashboard", "//evil.example", "https://evil.example/path"])(
    "falls back for unsafe redirect %s",
    (value) => {
      expect(getSafeRedirectPath(value, "/dashboard")).toBe("/dashboard");
    }
  );
});
