import type { ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  error,
  children,
  hint
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}
