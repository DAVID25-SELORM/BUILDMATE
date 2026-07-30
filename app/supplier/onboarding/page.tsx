import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupplierMembership, getSupplierOnboardingBundle } from "@/lib/supplier/data";
import { getNextIncompleteStep } from "@/lib/supplier/progress";
import { getOnboardingRouteDecision } from "@/lib/supplier/routing";
import { SupplierOnboardingWizard } from "@/components/supplier/onboarding/SupplierOnboardingWizard";
import { StatusBanner } from "@/components/supplier/StatusBanner";
import type { OnboardingStep } from "@/lib/supplier/constants";

export default async function SupplierOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getSupplierMembership(supabase, user.id);
  if (!membership) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <StatusBanner status="draft" showAction={false} reason="No supplier organisation is linked to this account yet. Contact support for help." />
      </div>
    );
  }

  const { organisation } = membership;
  const decision = getOnboardingRouteDecision(organisation.verification_status);

  if (decision.action === "redirect_dashboard") {
    redirect("/supplier");
  }

  if (decision.action === "show_status") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-2xl font-black">Supplier application</h1>
        <StatusBanner
          status={organisation.verification_status}
          reason={organisation.decision_reason ?? organisation.suspended_reason}
        />
      </div>
    );
  }

  const bundle = await getSupplierOnboardingBundle(supabase, organisation.id);
  const completedSteps = bundle.profile?.onboarding_completed_steps ?? [];
  const initialStep = (bundle.profile?.onboarding_step as OnboardingStep) ?? getNextIncompleteStep(completedSteps);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-black">Supplier application</h1>
        <p className="mt-1 text-sm text-slate-600">Complete every step, then submit for BuildMate review.</p>
      </div>
      <SupplierOnboardingWizard
        organisationId={organisation.id}
        organisationName={organisation.name}
        registrationNumber={organisation.registration_number}
        taxId={organisation.tax_id}
        initialStep={initialStep}
        initialCompletedSteps={completedSteps}
        profile={bundle.profile}
        branches={bundle.branches}
        delivery={bundle.delivery}
        documents={bundle.documents}
        hasSettlement={bundle.hasSettlement}
        maskedAccountNumber={bundle.maskedSettlement?.accountNumberMasked ?? ""}
        maskedMomoNumber={bundle.maskedSettlement?.momoNumberMasked ?? ""}
        decisionReason={organisation.verification_status === "information_required" ? organisation.decision_reason : null}
      />
    </div>
  );
}
