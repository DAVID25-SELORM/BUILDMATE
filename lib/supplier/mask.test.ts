import { describe, expect, it } from "vitest";
import { maskAccountNumber } from "./mask";

describe("maskAccountNumber", () => {
  it("keeps only the last 4 digits visible", () => {
    expect(maskAccountNumber("0123456789")).toBe("•••• 6789");
  });

  it("masks short numbers entirely", () => {
    expect(maskAccountNumber("123")).toBe("•••");
  });

  it("strips whitespace before masking", () => {
    expect(maskAccountNumber("0244 000 000")).toBe("•••• 0000");
  });

  it("returns an empty string for null or undefined", () => {
    expect(maskAccountNumber(null)).toBe("");
    expect(maskAccountNumber(undefined)).toBe("");
    expect(maskAccountNumber("")).toBe("");
  });

  it("never leaks more than the last 4 characters", () => {
    const masked = maskAccountNumber("9988776655");
    expect(masked).not.toContain("998877");
  });
});
