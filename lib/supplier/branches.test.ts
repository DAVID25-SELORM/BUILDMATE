import { describe, expect, it } from "vitest";
import { wouldCreateDuplicateMainBranch } from "./branches";

describe("wouldCreateDuplicateMainBranch", () => {
  it("allows the first main branch", () => {
    expect(wouldCreateDuplicateMainBranch([], null)).toBe(false);
  });

  it("blocks a second main branch when adding a new one", () => {
    const existing = [{ id: "a", isMainBranch: true }, { id: "b", isMainBranch: false }];
    expect(wouldCreateDuplicateMainBranch(existing, null)).toBe(true);
  });

  it("allows editing the existing main branch itself", () => {
    const existing = [{ id: "a", isMainBranch: true }, { id: "b", isMainBranch: false }];
    expect(wouldCreateDuplicateMainBranch(existing, "a")).toBe(false);
  });

  it("blocks promoting a second branch while another is still main", () => {
    const existing = [{ id: "a", isMainBranch: true }, { id: "b", isMainBranch: false }];
    expect(wouldCreateDuplicateMainBranch(existing, "b")).toBe(true);
  });
});
