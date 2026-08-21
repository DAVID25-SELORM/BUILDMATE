import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export default async function ProviderReviews() {
  const { user } = await requireUser();
  const s = await createClient();
  const { data: p } = await s
    .from("service_provider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: r } = p
    ? await s
        .from("service_reviews")
        .select("id,rating,comment,created_at")
        .eq("provider_id", p.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  return (
    <>
      <h1 className="text-3xl font-black">Reviews</h1>
      <p className="mt-2 text-slate-600">
        Only customers with completed service requests can leave reviews.
      </p>
      <div className="mt-6 space-y-3">
        {r?.map((x) => (
          <article className="card p-4" key={x.id}>
            <b>{x.rating}/5</b>
            <p className="mt-2 text-sm">{x.comment ?? "No written comment"}</p>
          </article>
        ))}
        {!r?.length && (
          <div className="card p-8 text-slate-500">No reviews yet.</div>
        )}
      </div>
    </>
  );
}
