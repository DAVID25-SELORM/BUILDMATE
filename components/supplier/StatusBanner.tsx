import Link from "next/link";
import { VERIFICATION_STATUS_LABELS, type VerificationStatus } from "@/lib/supplier/constants";

const STATUS_STYLES: Record<VerificationStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-blue-50 text-blue-700",
  information_required: "bg-amber-50 text-amber-800",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  suspended: "bg-red-50 text-red-700"
};

const STATUS_MESSAGES: Record<VerificationStatus, string> = {
  draft: "Finish onboarding to submit your supplier application.",
  submitted: "Your application has been submitted. BuildMate typically reviews applications within a few business days.",
  under_review: "Your application is under review.",
  information_required: "BuildMate needs more information before it can continue reviewing your application.",
  approved: "Your account is verified and ready to trade.",
  rejected: "This application was not approved.",
  suspended: "Trading has been suspended on this account."
};

export function StatusBanner({
  status,
  reason,
  showAction = true,
  audience = "supplier"
}: {
  status: VerificationStatus;
  reason?: string | null;
  showAction?: boolean;
  audience?: "supplier" | "admin";
}) {
  const message = audience === "admin" && status === "submitted"
    ? "This application is awaiting platform review. Start the review, request more information, or approve it below."
    : STATUS_MESSAGES[status];
  return (
    <div className={`card p-6 ${STATUS_STYLES[status]}`}>
      <p className="text-xs font-bold uppercase tracking-wide">{VERIFICATION_STATUS_LABELS[status]}</p>
      <p className="mt-2 font-semibold">{message}</p>
      {reason && <p className="mt-2 text-sm">Reason: {reason}</p>}
      {showAction && (status === "draft" || status === "information_required") && (
        <Link href="/supplier/onboarding" className="btn-primary mt-4 inline-flex">
          {status === "draft" ? "Continue application" : "Update application"}
        </Link>
      )}
    </div>
  );
}
