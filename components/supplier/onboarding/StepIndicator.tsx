import { ONBOARDING_STEPS, ONBOARDING_STEP_LABELS, type OnboardingStep } from "@/lib/supplier/constants";
import { getOnboardingProgress } from "@/lib/supplier/progress";

export function StepIndicator({
  currentStep,
  completedSteps,
  onSelectStep
}: {
  currentStep: OnboardingStep;
  completedSteps: string[];
  onSelectStep: (step: OnboardingStep) => void;
}) {
  const progress = getOnboardingProgress(completedSteps);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>Application progress</span>
        <span className="text-brand-700">{progress}% complete</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step);
          const isCurrent = step === currentStep;
          const isReachable = isCompleted || isCurrent || completedSteps.length >= index;
          return (
            <li key={step}>
              <button
                type="button"
                onClick={() => isReachable && onSelectStep(step)}
                disabled={!isReachable}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium ${
                  isCurrent ? "bg-brand-50 text-brand-700" : isCompleted ? "text-slate-700 hover:bg-slate-50" : "text-slate-400"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCompleted ? "bg-brand-600 text-white" : isCurrent ? "border-2 border-brand-600 text-brand-700" : "border border-slate-300"
                  }`}
                >
                  {isCompleted ? "✓" : index + 1}
                </span>
                {ONBOARDING_STEP_LABELS[step]}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
