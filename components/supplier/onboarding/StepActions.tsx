export function StepActions({
  onBack,
  showBack,
  loading,
  error
}: {
  onBack?: () => void;
  showBack: boolean;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="mt-8">
      {error && <p className="mb-4 text-sm font-medium text-red-600" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {showBack && (
            <button type="button" onClick={onBack} className="btn-secondary" disabled={loading}>
              Back
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button type="submit" name="intent" value="draft" className="btn-secondary" disabled={loading}>
            Save as draft
          </button>
          <button type="submit" name="intent" value="continue" className="btn-primary" disabled={loading}>
            {loading ? "Saving..." : "Save & continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
