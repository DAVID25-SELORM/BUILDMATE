import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export default async function ProviderProfile() {
  const { user } = await requireUser();
  const s = await createClient();
  const { data: p } = await s
    .from("service_provider_profiles")
    .select(
      "display_name,bio,phone,region,city,verification_status,service_provider_categories(experience_years,base_price,price_unit,service_categories(name)),service_provider_skills(name),service_provider_areas(region,city,area),service_provider_documents(document_type,status,expires_at)",
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
        </div>
      ) : (
        <p className="card mt-6 p-6">
          Create your provider profile from Overview.
        </p>
      )}
    </>
  );
}
