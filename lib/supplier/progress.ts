import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/supplier/constants";

export function getOnboardingProgress(completedSteps: string[]): number {
  const completedCount = ONBOARDING_STEPS.filter((step) => completedSteps.includes(step)).length;
  return Math.round((completedCount / ONBOARDING_STEPS.length) * 100);
}

export function getNextIncompleteStep(completedSteps: string[]): OnboardingStep {
  const next = ONBOARDING_STEPS.find((step) => !completedSteps.includes(step));
  return next ?? "review";
}

export function markStepCompleted(completedSteps: string[], step: OnboardingStep): string[] {
  if (completedSteps.includes(step)) return completedSteps;
  return [...completedSteps, step];
}
