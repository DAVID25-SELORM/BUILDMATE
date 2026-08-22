import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function AdminSectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-extrabold text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AdminMetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tabular-nums text-slate-950">{value}</p>
        </div>
        <span className="rounded-xl bg-brand-50 p-2 text-brand-700" aria-hidden="true"><Icon size={19} /></span>
      </div>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

export function AdminStatusBadge({ status }: { status: string }) {
  const positive = status === "completed" || status === "approved" || status === "resolved";
  const caution = ["pending", "open", "in_progress", "under_review"].includes(status);
  return <span className={`rounded-full px-2 py-1 text-[10px] font-bold capitalize ${positive ? "bg-emerald-50 text-emerald-700" : caution ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{status.replaceAll("_", " ")}</span>;
}

export function AdminQuickAction({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  return <Link href={href} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs font-bold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"><Icon size={19} aria-hidden="true" />{label}</Link>;
}
