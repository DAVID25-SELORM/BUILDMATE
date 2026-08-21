"use client";

import { BranchesStep } from "@/components/supplier/onboarding/steps/BranchesStep";
import type { SupplierBranchRow } from "@/lib/supplier/types";

export function BranchManager({
  organisationId,
  branches,
}: {
  organisationId: string;
  branches: SupplierBranchRow[];
}) {
  return (
    <BranchesStep
      organisationId={organisationId}
      initialBranches={branches}
      completedSteps={["branches"]}
      onBack={() => undefined}
      onSaved={() => window.location.reload()}
    />
  );
}
