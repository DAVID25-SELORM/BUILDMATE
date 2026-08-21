import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Find trusted professionals | BuildMate Ghana",
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: categories }, { data: providers }] = await Promise.all([
    supabase
      .from("service_categories")
      .select("id,name,slug,description")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("service_provider_profiles")
      .select(
        "id,display_name,bio,region,city,availability_status,average_rating,review_count,completed_jobs,service_provider_categories(category_id,base_price,price_unit,service_categories(name,slug)),service_provider_skills(name)",
      )
      .eq("verification_status", "approved")
      .eq("account_status", "active")
      .order("average_rating", { ascending: false }),
  ]);
  const filtered = (providers ?? []).filter(
    (provider) =>
      (!q.region || provider.region === q.region) &&
      (!q.availability || provider.availability_status === q.availability) &&
      (!q.category ||
        (
          provider.service_provider_categories as unknown as
            { service_categories: { slug: string } | null }[] | null
        )?.some((item) => item.service_categories?.slug === q.category)),
  );
  return (
    <main className="container-shell py-10">
      <div className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-brand-700">
          BuildMate Services
        </p>
        <h1 className="mt-2 text-4xl font-black">
          Find trusted professionals for your project
        </h1>
        <p className="mt-3 text-lg text-slate-600">
          Discover verified providers, compare experience and availability, then
          manage the full request from your dashboard.
        </p>
      </div>
      <form className="card mt-8 grid gap-3 p-4 md:grid-cols-4">
        <select
          className="input"
          name="category"
          defaultValue={q.category ?? ""}
        >
          <option value="">All services</option>
          {categories?.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          name="region"
          defaultValue={q.region}
          placeholder="Region"
        />
        <select
          className="input"
          name="availability"
          defaultValue={q.availability ?? ""}
        >
          <option value="">Any availability</option>
          <option value="available">Available now</option>
          <option value="busy">Busy</option>
        </select>
        <button className="btn-primary">Find providers</button>
      </form>
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((provider) => {
          const services = provider.service_provider_categories as unknown as
            | {
                service_categories: { name: string } | null;
                base_price: number | null;
                price_unit: string | null;
              }[]
            | null;
          return (
            <article className="card flex flex-col p-5" key={provider.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{provider.display_name}</h2>
                  <p className="text-sm text-slate-500">
                    {[provider.city, provider.region]
                      .filter(Boolean)
                      .join(", ") || "Service area available on request"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-bold ${provider.availability_status === "available" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
                >
                  {provider.availability_status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-3 line-clamp-3 text-sm text-slate-600">
                {provider.bio || "Verified BuildMate service provider."}
              </p>
              <p className="mt-3 text-sm font-semibold">
                {Number(provider.average_rating).toFixed(1)} ★ ·{" "}
                {provider.review_count} reviews · {provider.completed_jobs} jobs
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {services?.slice(0, 3).map((service, index) => (
                  <span
                    className="rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-800"
                    key={index}
                  >
                    {service.service_categories?.name}
                  </span>
                ))}
              </div>
              <Link
                className="btn-primary mt-5 text-center"
                href={`/services/providers/${provider.id}`}
              >
                View profile
              </Link>
            </article>
          );
        })}
        {!filtered.length && (
          <div className="card p-8 text-slate-600 md:col-span-2 xl:col-span-3">
            No verified providers match these filters yet. Try a broader area or
            service.
          </div>
        )}
      </div>
    </main>
  );
}
