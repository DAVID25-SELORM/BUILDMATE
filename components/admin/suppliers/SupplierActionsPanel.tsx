"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveSupplier,
  assignReviewer,
  addReviewNote,
  reinstateSupplier,
  rejectSupplier,
  requestInformation,
  startReview,
  suspendSupplier
} from "@/app/admin/suppliers/actions";
import { VERIFICATION_LEVELS, VERIFICATION_LEVEL_LABELS, type VerificationLevel, type VerificationStatus } from "@/lib/supplier/constants";

export function SupplierActionsPanel({
  organisationId,
  status,
  currentVerificationLevels,
  reviewers,
  currentReviewerId
}: {
  organisationId: string;
  status: VerificationStatus;
  currentVerificationLevels: VerificationLevel[];
  reviewers: { id: string; full_name: string }[];
  currentReviewerId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonMode, setReasonMode] = useState<"approve" | "reinstate" | "reject" | "information_required" | "suspend" | null>(null);
  const [reason, setReason] = useState("");
  const [levels, setLevels] = useState<VerificationLevel[]>(currentVerificationLevels);
  const [note, setNote] = useState("");
  const [reviewerId, setReviewerId] = useState(currentReviewerId ?? "");

  function toggleLevel(level: VerificationLevel) {
    setLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));
  }

  async function run(fn: () => Promise<{ success: boolean; error?: string }>) {
    setLoading(true);
    setError(null);
    const result = await fn();
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong");
      return;
    }
    setReasonMode(null);
    setReason("");
    router.refresh();
  }

  return (
    <div className="card space-y-6 p-6">
      <h2 className="text-lg font-bold">Review actions</h2>
      {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {status === "submitted" && (
          <button type="button" className="btn-secondary" disabled={loading} onClick={() => run(() => startReview(organisationId))}>Start review</button>
        )}
        {(status === "submitted" || status === "under_review") && (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={loading}
              onClick={() => {
                setReasonMode("approve");
              }}
            >
              Approve
            </button>
            <button type="button" className="btn-secondary" disabled={loading} onClick={() => setReasonMode("reject")}>Reject</button>
            <button type="button" className="btn-secondary" disabled={loading} onClick={() => setReasonMode("information_required")}>Request information</button>
          </>
        )}
        {status === "approved" && (
          <button type="button" className="btn-secondary" disabled={loading} onClick={() => setReasonMode("suspend")}>Suspend</button>
        )}
        {status === "suspended" && (
          <button type="button" className="btn-primary" disabled={loading} onClick={() => setReasonMode("reinstate")}>Reinstate</button>
        )}
      </div>

      {(status === "submitted" || status === "under_review") && (
        <div>
          <p className="label">Verification levels to grant on approval</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {VERIFICATION_LEVELS.map((level) => (
              <label key={level} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <input type="checkbox" checked={levels.includes(level)} onChange={() => toggleLevel(level)} />
                {VERIFICATION_LEVEL_LABELS[level]}
              </label>
            ))}
          </div>
        </div>
      )}

      {reasonMode && (
        <div className="rounded-xl border border-slate-200 p-4">
          <label className="label" htmlFor="reason">
            {reasonMode === "approve" ? "Approval reason" : reasonMode === "reinstate" ? "Reinstatement reason" : reasonMode === "reject" ? "Rejection reason" : reasonMode === "suspend" ? "Suspension reason" : "What information is required?"}
          </label>
          <textarea id="reason" className="input min-h-24" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-3 flex gap-3">
            <button type="button" className="btn-secondary" onClick={() => setReasonMode(null)} disabled={loading}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              disabled={loading}
              onClick={() =>
                run(() =>
                  reasonMode === "approve"
                    ? approveSupplier(organisationId, levels, reason)
                    : reasonMode === "reinstate"
                      ? reinstateSupplier(organisationId, reason)
                  : reasonMode === "reject"
                    ? rejectSupplier(organisationId, reason)
                    : reasonMode === "suspend"
                      ? suspendSupplier(organisationId, reason)
                      : requestInformation(organisationId, reason)
                )
              }
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 pt-5">
        <label className="label" htmlFor="reviewer">Assign reviewer</label>
        <div className="flex gap-2">
          <select id="reviewer" className="input" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
            <option value="">Unassigned</option>
            {reviewers.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
          <button type="button" className="btn-secondary shrink-0" disabled={loading || !reviewerId} onClick={() => run(() => assignReviewer(organisationId, reviewerId))}>Assign</button>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-5">
        <label className="label" htmlFor="note">Internal note</label>
        <textarea id="note" className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          type="button"
          className="btn-secondary mt-3"
          disabled={loading || !note.trim()}
          onClick={() => run(async () => {
            const result = await addReviewNote(organisationId, note);
            if (result.success) setNote("");
            return result;
          })}
        >
          Add note
        </button>
      </div>
    </div>
  );
}
