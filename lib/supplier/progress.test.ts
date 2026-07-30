import { describe, expect, it } from "vitest";
import { getOnboardingProgress, getNextIncompleteStep, markStepCompleted } from "./progress";

describe("getOnboardingProgress", () => {
  it("is 0% with no completed steps", () => {
    expect(getOnboardingProgress([])).toBe(0);
  });

  it("is 100% once every step is completed", () => {
    const all = ["business_information", "contact_information", "registration_compliance", "branches", "delivery_coverage", "settlement", "documents", "review"];
    expect(getOnboardingProgress(all)).toBe(100);
  });

  it("ignores unknown step names", () => {
    expect(getOnboardingProgress(["not_a_real_step"])).toBe(0);
  });
});

describe("getNextIncompleteStep", () => {
  it("starts at business information", () => {
    expect(getNextIncompleteStep([])).toBe("business_information");
  });

  it("resumes at the first step not yet completed", () => {
    expect(getNextIncompleteStep(["business_information", "contact_information"])).toBe("registration_compliance");
  });

  it("lands on review once everything else is done", () => {
    const all = ["business_information", "contact_information", "registration_compliance", "branches", "delivery_coverage", "settlement", "documents"];
    expect(getNextIncompleteStep(all)).toBe("review");
  });
});

describe("markStepCompleted", () => {
  it("adds a new step to the list", () => {
    expect(markStepCompleted([], "business_information")).toEqual(["business_information"]);
  });

  it("does not duplicate an already-completed step", () => {
    expect(markStepCompleted(["business_information"], "business_information")).toEqual(["business_information"]);
  });
});
