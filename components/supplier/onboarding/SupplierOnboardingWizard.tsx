"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StepIndicator } from "@/components/supplier/onboarding/StepIndicator";
import { BusinessInformationStep } from "@/components/supplier/onboarding/steps/BusinessInformationStep";
import { ContactInformationStep } from "@/components/supplier/onboarding/steps/ContactInformationStep";
import { RegistrationComplianceStep } from "@/components/supplier/onboarding/steps/RegistrationComplianceStep";
import { BranchesStep } from "@/components/supplier/onboarding/steps/BranchesStep";
import { DeliveryCoverageStep } from "@/components/supplier/onboarding/steps/DeliveryCoverageStep";
import { SettlementStep } from "@/components/supplier/onboarding/steps/SettlementStep";
import { DocumentsStep } from "@/components/supplier/onboarding/steps/DocumentsStep";
import { ReviewStep } from "@/components/supplier/onboarding/steps/ReviewStep";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/supplier/constants";
import { markStepCompleted } from "@/lib/supplier/progress";
import type { SupplierBranchRow, SupplierDeliveryCoverageRow, SupplierDocumentRow, SupplierProfileRow } from "@/lib/supplier/types";

export function SupplierOnboardingWizard({
  organisationId,
  organisationName,
  registrationNumber,
  taxId,
  initialStep,
  initialCompletedSteps,
  profile,
  branches,
  delivery,
  documents,
  hasSettlement,
  maskedAccountNumber,
  maskedMomoNumber,
  decisionReason
}: {
  organisationId: string;
  organisationName: string;
  registrationNumber: string | null;
  taxId: string | null;
  initialStep: OnboardingStep;
  initialCompletedSteps: string[];
  profile: SupplierProfileRow | null;
  branches: SupplierBranchRow[];
  delivery: SupplierDeliveryCoverageRow | null;
  documents: SupplierDocumentRow[];
  hasSettlement: boolean;
  maskedAccountNumber: string;
  maskedMomoNumber: string;
  decisionReason: string | null;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
  const [completedSteps, setCompletedSteps] = useState<string[]>(initialCompletedSteps);

  function goToStep(step: OnboardingStep) {
    setCurrentStep(step);
  }

  function handleStepSaved(step: OnboardingStep, advance: boolean) {
    setCompletedSteps((prev) => markStepCompleted(prev, step));
    router.refresh();
    if (advance) {
      const index = ONBOARDING_STEPS.indexOf(step);
      const next = ONBOARDING_STEPS[index + 1] ?? "review";
      setCurrentStep(next);
    }
  }

  function goBack(step: OnboardingStep) {
    const index = ONBOARDING_STEPS.indexOf(step);
    setCurrentStep(ONBOARDING_STEPS[Math.max(0, index - 1)]);
  }

  return (
    <div className="space-y-6">
      {decisionReason && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">BuildMate requested more information</p>
          <p className="mt-1">{decisionReason}</p>
        </div>
      )}

      <StepIndicator currentStep={currentStep} completedSteps={completedSteps} onSelectStep={goToStep} />

      {currentStep === "business_information" && (
        <BusinessInformationStep
          organisationId={organisationId}
          completedSteps={completedSteps}
          showBack={false}
          onBack={() => {}}
          initial={{
            registeredName: organisationName,
            tradingName: profile?.trading_name ?? "",
            businessType: profile?.business_type ?? "sole_proprietorship",
            businessDescription: profile?.business_description ?? "",
            yearEstablished: profile?.year_established ?? new Date().getFullYear(),
            website: profile?.website ?? "",
            primaryCategories: profile?.primary_categories ?? [],
            numberOfBranches: profile?.branch_count ?? 1,
            numberOfEmployees: profile?.employee_count ?? 1
          }}
          onSaved={(advance) => handleStepSaved("business_information", advance)}
        />
      )}

      {currentStep === "contact_information" && (
        <ContactInformationStep
          organisationId={organisationId}
          completedSteps={completedSteps}
          onBack={() => goBack("contact_information")}
          initial={{
            primaryContactName: profile?.primary_contact_name ?? "",
            primaryPhone: profile?.primary_phone ?? "",
            alternativePhone: profile?.alternative_phone ?? "",
            businessEmail: profile?.business_email ?? "",
            whatsappNumber: profile?.whatsapp_number ?? "",
            physicalAddress: profile?.physical_address ?? "",
            region: profile?.region ?? "",
            city: profile?.city ?? "",
            area: profile?.area ?? "",
            ghanaPostGps: profile?.ghanapost_gps ?? ""
          }}
          onSaved={(advance) => handleStepSaved("contact_information", advance)}
        />
      )}

      {currentStep === "registration_compliance" && (
        <RegistrationComplianceStep
          organisationId={organisationId}
          completedSteps={completedSteps}
          onBack={() => goBack("registration_compliance")}
          initial={{
            registrationNumber: registrationNumber ?? "",
            tin: taxId ?? "",
            vatRegistered: profile?.vat_registered ?? false,
            vatNumber: profile?.vat_number ?? "",
            gsaRegistrationNumber: profile?.gsa_registration_number ?? "",
            distributorAuthorisationNumber: profile?.distributor_authorisation_number ?? "",
            registrationDocumentExpiry: profile?.registration_document_expiry ?? "",
            vatCertificateExpiry: profile?.vat_certificate_expiry ?? "",
            distributorAuthorisationExpiry: profile?.distributor_authorisation_expiry ?? ""
          }}
          onSaved={(advance) => handleStepSaved("registration_compliance", advance)}
        />
      )}

      {currentStep === "branches" && (
        <BranchesStep
          organisationId={organisationId}
          initialBranches={branches}
          completedSteps={completedSteps}
          onBack={() => goBack("branches")}
          onSaved={(advance) => handleStepSaved("branches", advance)}
        />
      )}

      {currentStep === "delivery_coverage" && (
        <DeliveryCoverageStep
          organisationId={organisationId}
          completedSteps={completedSteps}
          onBack={() => goBack("delivery_coverage")}
          initial={{
            regionsServed: delivery?.regions_served ?? [],
            citiesServed: delivery?.cities_served ?? [],
            maxDeliveryRadiusKm: delivery?.max_delivery_radius_km ?? null,
            minimumOrderValue: delivery?.minimum_order_value ?? null,
            sameDayDelivery: delivery?.same_day_delivery ?? false,
            standardLeadTimeDays: delivery?.standard_lead_time_days ?? 1,
            customerPickupAvailable: delivery?.customer_pickup_available ?? false,
            deliveryHandledBy: delivery?.delivery_handled_by ?? "internal"
          }}
          onSaved={(advance) => handleStepSaved("delivery_coverage", advance)}
        />
      )}

      {currentStep === "settlement" && (
        <SettlementStep
          organisationId={organisationId}
          hasSettlement={hasSettlement}
          maskedAccountNumber={maskedAccountNumber}
          maskedMomoNumber={maskedMomoNumber}
          completedSteps={completedSteps}
          onBack={() => goBack("settlement")}
          onSaved={(advance) => handleStepSaved("settlement", advance)}
        />
      )}

      {currentStep === "documents" && (
        <DocumentsStep
          organisationId={organisationId}
          initialDocuments={documents}
          completedSteps={completedSteps}
          onBack={() => goBack("documents")}
          onSaved={(advance) => handleStepSaved("documents", advance)}
        />
      )}

      {currentStep === "review" && (
        <ReviewStep
          organisationId={organisationId}
          organisationName={organisationName}
          registrationNumber={registrationNumber}
          taxId={taxId}
          profile={profile}
          branches={branches}
          delivery={delivery}
          documents={documents}
          hasSettlement={hasSettlement}
          completedSteps={completedSteps}
          onBack={() => goBack("review")}
          onSubmitted={() => router.push("/supplier")}
        />
      )}
    </div>
  );
}
