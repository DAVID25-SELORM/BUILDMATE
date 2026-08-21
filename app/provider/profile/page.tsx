import { updateProviderProfile } from "@/app/services/actions";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export default async function ProviderProfile({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const q = await searchParams;
  const { user } = await requireUser();
  const s = await createClient();
  const { data: p } = await s
    .from("service_provider_profiles")
    .select(
      "id,display_name,bio,phone,region,city,service_radius_km,verification_status,service_provider_categories(experience_years,base_price,price_unit,service_categories(name)),service_provider_skills(name),service_provider_areas(region,city,area),service_provider_documents(document_type,status,expires_at)",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <>
      <h1 className="text-3xl font-black">Profile & services</h1>
      <p className="mt-2 text-slate-600">
        Your shared professional identity, verification and service coverage.
      </p>
      {p ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="text-xl font-bold">{p.display_name}</h2>
            <p className="mt-2 text-sm text-slate-600">{p.bio}</p>
            <p className="mt-3 text-sm">
              {p.phone} · {[p.city, p.region].filter(Boolean).join(", ")}
            </p>
          </section>
          <section className="card p-5">
            <h2 className="text-xl font-bold">Verification</h2>
            <p className="mt-2 capitalize">
              {p.verification_status.replaceAll("_", " ")}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Document requirements are configurable and reviewed by BuildMate
              administrators.
            </p>
          </section>
          <form
            className="card space-y-4 p-5 lg:col-span-2"
            action={updateProviderProfile.bind(null, p.id)}
          >
            <div>
              <h2 className="text-xl font-bold">Edit public profile</h2>
              <p className="mt-1 text-sm text-slate-600">
                Material edits to an approved profile return it to review before
                public visibility resumes.
              </p>
            </div>
            {q.error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {q.error}
              </p>
            )}
            {q.saved && (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                Profile saved and submitted for review.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="label">Display name</span>
                <input
                  className="input"
                  name="displayName"
                  defaultValue={p.display_name}
                  required
                  minLength={2}
                />
              </label>
              <label>
                <span className="label">Phone</span>
                <input
                  className="input"
                  name="phone"
                  defaultValue={p.phone ?? ""}
                />
              </label>
            </div>
            <label className="block">
              <span className="label">About your work</span>
              <textarea
                className="input min-h-28"
                name="bio"
                defaultValue={p.bio ?? ""}
                required
                minLength={20}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label>
                <span className="label">Region</span>
                <input
                  className="input"
                  name="region"
                  defaultValue={p.region ?? ""}
                  required
                />
              </label>
              <label>
                <span className="label">City</span>
                <input
                  className="input"
                  name="city"
                  defaultValue={p.city ?? ""}
                />
              </label>
              <label>
                <span className="label">Service radius (km)</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  name="serviceRadiusKm"
                  defaultValue={p.service_radius_km ?? ""}
                />
              </label>
            </div>
            <button className="btn-primary">Save profile</button>
          </form>
        </div>
      ) : (
        <p className="card mt-6 p-6">
          Create your provider profile from Overview.
        </p>
      )}
    </>
  );
}
