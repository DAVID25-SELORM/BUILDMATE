import Link from "next/link";
import { createProviderProfile } from "@/app/services/actions";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function ProviderDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const q = await searchParams;
  const { user, profile } = await requireUser();
  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("service_provider_profiles")
    .select(
      "id,display_name,verification_status,availability_status,average_rating,review_count,completed_jobs",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: categories } = !provider
    ? await supabase
        .from("service_categories")
        .select("id,name")
        .eq("is_active", true)
        .order("sort_order")
    : { data: [] };
  if (!provider)
    return (
      <>
        <h1 className="text-3xl font-black">
          Become a BuildMate service provider
        </h1>
        <p className="mt-2 text-slate-600">
          Create one shared professional profile. Administrators review it
          before it appears publicly.
        </p>
        {q.error && (
          <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">
            {q.error}
          </p>
        )}
        <form
          action={createProviderProfile}
          className="card mt-6 max-w-2xl space-y-4 p-6"
        >
          <label className="block">
            <span className="label">Professional or business name</span>
            <input
              className="input"
              name="displayName"
              defaultValue={profile?.full_name ?? ""}
              required
              minLength={2}
            />
          </label>
          <label className="block">
            <span className="label">About your work</span>
            <textarea
              className="input min-h-28"
              name="bio"
              required
              minLength={20}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <input className="input" name="phone" placeholder="Phone" />
            <input
              className="input"
              name="region"
              placeholder="Region"
              required
            />
            <input className="input" name="city" placeholder="City" />
          </div>
          <fieldset>
            <legend className="label">Services you provide</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {categories?.map((category) => (
                <label
                  className="rounded-xl border p-3 text-sm"
                  key={category.id}
                >
                  <input
                    className="mr-2"
                    type="checkbox"
                    name="categoryIds"
                    value={category.id}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </fieldset>
          <button className="btn-primary">Submit provider profile</button>
        </form>
      </>
    );
  const { data: requests } = await supabase
    .from("service_requests")
    .select("id,status")
    .eq("provider_id", provider.id);
  const count = (status: string) =>
    requests?.filter((row) => row.status === status).length ?? 0;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">
            Welcome, {provider.display_name}
          </h1>
          <p className="mt-2 text-slate-600">
            Manage requests, availability and your public reputation.
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-2 text-sm font-bold capitalize text-brand-800">
          {provider.verification_status.replaceAll("_", " ")}
        </span>
      </div>
      {provider.verification_status !== "approved" && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Your public listing remains hidden while BuildMate reviews your
          profile and documents.
        </div>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["New requests", count("requested")],
          ["Accepted", count("accepted")],
          ["In progress", count("in_progress")],
          [
            "Rating",
            `${Number(provider.average_rating).toFixed(1)} (${provider.review_count})`,
          ],
        ].map(([label, value]) => (
          <div className="card p-5" key={label}>
            <p className="text-sm text-slate-600">{label}</p>
            <b className="mt-2 block text-3xl">{value}</b>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="btn-primary" href="/provider/requests">
          Review requests
        </Link>
        <Link className="btn-secondary" href="/provider/availability">
          Update availability
        </Link>
        <Link className="btn-secondary" href="/provider/profile">
          Complete profile
        </Link>
      </div>
    </>
  );
}
