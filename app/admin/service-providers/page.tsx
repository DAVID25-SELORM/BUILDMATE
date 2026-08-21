import Link from "next/link";
import { reviewProvider } from "@/app/admin/service-providers/actions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { createClient } from "@/lib/supabase/server";
export default async function AdminServiceProviders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const q = await searchParams;
  const s = await createClient();
  let query = s
    .from("service_provider_profiles")
    .select(
      "id,display_name,region,city,verification_status,account_status,availability_status,average_rating,review_count,completed_jobs,created_at,profiles(full_name,email)",
    )
    .order("created_at", { ascending: false });
  if (q.status) query = query.eq("verification_status", q.status);
  const { data, error } = await query;
  return (
    <DashboardShell title="Platform administration" nav={[...ADMIN_NAV]}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">Service providers</h1>
          <p className="mt-2 text-slate-600">
            Onboarding, verification, availability and marketplace oversight.
          </p>
        </div>
        <Link className="btn-secondary" href="/admin/preview/provider">
          Open generic provider preview
        </Link>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {[
          "",
          "submitted",
          "under_review",
          "information_required",
          "approved",
          "suspended",
        ].map((status) => (
          <Link
            className="rounded-full bg-slate-100 px-3 py-2 text-sm capitalize"
            href={
              status
                ? `/admin/service-providers?status=${status}`
                : "/admin/service-providers"
            }
            key={status || "all"}
          >
            {status ? status.replaceAll("_", " ") : "All"}
          </Link>
        ))}
      </div>
      {error && <p className="mt-4 text-red-700">{error.message}</p>}
      <div className="mt-6 space-y-4">
        {data?.map((p) => (
          <article className="card p-5" key={p.id}>
            <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
              <div>
                <h2 className="text-lg font-bold">{p.display_name}</h2>
                <p className="text-sm text-slate-500">
                  {[p.city, p.region].filter(Boolean).join(", ")}
                </p>
              </div>
              <p className="capitalize">
                <b>Status:</b> {p.verification_status.replaceAll("_", " ")}
              </p>
              <p>
                <b>Jobs:</b> {p.completed_jobs} ·{" "}
                {Number(p.average_rating).toFixed(1)} ★
              </p>
              <p className="capitalize">
                <b>Availability:</b> {p.availability_status}
              </p>
            </div>
            <form
              action={reviewProvider.bind(null, p.id)}
              className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]"
            >
              <select
                className="input"
                name="status"
                defaultValue={p.verification_status}
              >
                <option value="approved">Approve</option>
                <option value="information_required">
                  Request information
                </option>
                <option value="rejected">Reject</option>
                <option value="suspended">Suspend</option>
              </select>
              <input
                className="input"
                name="reason"
                required
                minLength={5}
                placeholder="Decision reason (audited)"
              />
              <button className="btn-primary">Save decision</button>
            </form>
          </article>
        ))}
        {!data?.length && !error && (
          <div className="card p-8 text-center text-slate-500">
            No providers match this filter.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
