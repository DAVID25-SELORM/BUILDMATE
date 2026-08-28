import { notFound } from "next/navigation";
import { createServiceRequest } from "@/app/services/actions";
import { createClient } from "@/lib/supabase/server";

export default async function ProviderProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: provider }, { data: reviews }] = await Promise.all([
    supabase
      .from("service_provider_profiles")
      .select(
        "id,display_name,bio,region,city,availability_status,average_rating,review_count,completed_jobs,service_provider_categories(category_id,experience_years,base_price,price_unit,service_categories(name)),service_provider_skills(name),service_provider_areas(region,city,area)",
      )
      .eq("id", id)
      .eq("verification_status", "approved")
      .eq("account_status", "active")
      .maybeSingle(),
    supabase
      .from("service_reviews")
      .select(
        "id,rating,comment,created_at,profiles!service_reviews_customer_id_fkey(full_name)",
      )
      .eq("provider_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (!provider) notFound();
  const services = provider.service_provider_categories as unknown as {
    category_id: string;
    experience_years: number | null;
    base_price: number | null;
    price_unit: string | null;
    service_categories: { name: string } | null;
  }[];
  return (
    <main className="container-shell py-10">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="text-sm font-bold uppercase text-brand-700">
            Verified service provider
          </p>
          <h1 className="mt-2 text-4xl font-black">{provider.display_name}</h1>
          <p className="mt-2 text-slate-500">
            {[provider.city, provider.region].filter(Boolean).join(", ")} ·{" "}
            {provider.availability_status.replaceAll("_", " ")}
          </p>
          <p className="mt-5 text-slate-700">
            {provider.bio ||
              "This provider has completed BuildMate verification."}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <b>{Number(provider.average_rating).toFixed(1)} ★</b>
              <p className="text-xs text-slate-500">
                {provider.review_count} reviews
              </p>
            </div>
            <div className="card p-4">
              <b>{provider.completed_jobs}</b>
              <p className="text-xs text-slate-500">completed jobs</p>
            </div>
            <div className="card p-4">
              <b>{services.length}</b>
              <p className="text-xs text-slate-500">service categories</p>
            </div>
          </div>
          <h2 className="mt-8 text-2xl font-bold">Services</h2>
          <div className="mt-3 space-y-3">
            {services.map((service) => (
              <div className="card p-4" key={service.category_id}>
                <b>{service.service_categories?.name}</b>
                <p className="text-sm text-slate-600">
                  {service.experience_years
                    ? `${service.experience_years} years experience`
                    : "Experience verified during review"}
                  {service.base_price
                    ? ` · From GHS ${service.base_price} ${service.price_unit ?? ""}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
          <h2 className="mt-8 text-2xl font-bold">Customer reviews</h2>
          <div className="mt-3 space-y-3">
            {reviews?.map((review) => (
              <article className="card p-4" key={review.id}>
                <b>{review.rating}/5</b>
                <p className="mt-1 text-sm">
                  {review.comment || "No written comment"}
                </p>
              </article>
            ))}
            {!reviews?.length && (
              <p className="text-slate-500">No reviews yet.</p>
            )}
          </div>
        </div>
        <aside className="card h-fit p-5">
          <h2 className="text-xl font-bold">Request this professional</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sign-in is required. Your request remains private between you, the
            provider and authorised administrators.
          </p>
          {q.error && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {q.error}
            </p>
          )}
          {services.length ? (
            <form
              className="mt-5 space-y-3"
              action={createServiceRequest.bind(null, provider.id)}
            >
              <label className="block">
                <span className="label">Service needed</span>
                <select className="input" name="categoryId" required>
                  {services.map((service) => (
                    <option value={service.category_id} key={service.category_id}>
                      {service.service_categories?.name}
                    </option>
                  ))}
                </select>
              </label>
              <input
                className="input"
                name="title"
                required
                minLength={4}
                placeholder="What do you need?"
              />
              <textarea
                className="input min-h-28"
                name="description"
                required
                minLength={10}
                placeholder="Describe the work, scope and site conditions"
              />
              <input
                className="input"
                name="region"
                required
                placeholder="Region"
              />
              <input className="input" name="city" placeholder="City / area" />
              <input
                className="input"
                name="address"
                placeholder="Service address"
              />
              <label className="block">
                <span className="label">Preferred date and time</span>
                <input
                  className="input"
                  type="datetime-local"
                  name="preferredAt"
                />
              </label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                name="budget"
                placeholder="Budget (optional)"
              />
              <button className="btn-primary w-full">
                Send service request
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-amber-800">
              This provider has no active services.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
