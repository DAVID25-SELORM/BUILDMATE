import { updateProviderAvailability } from "@/app/services/actions";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export default async function ProviderAvailability({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const q = await searchParams;
  const { user } = await requireUser();
  const s = await createClient();
  const { data: p } = await s
    .from("service_provider_profiles")
    .select("id,availability_status,available_from,available_until")
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <>
      <h1 className="text-3xl font-black">Availability</h1>
      <p className="mt-2 text-slate-600">
        Availability is separate from whether you are currently online.
      </p>
      {q.error && <p className="mt-4 text-red-700">{q.error}</p>}
      {p ? (
        <form
          className="card mt-6 max-w-2xl space-y-4 p-6"
          action={updateProviderAvailability.bind(null, p.id)}
        >
          <label className="block">
            <span className="label">Status</span>
            <select
              className="input"
              name="status"
              defaultValue={p.availability_status}
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Unavailable</option>
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Available from</span>
              <input
                className="input"
                type="datetime-local"
                name="availableFrom"
              />
            </label>
            <label>
              <span className="label">Available until</span>
              <input
                className="input"
                type="datetime-local"
                name="availableUntil"
              />
            </label>
          </div>
          <button className="btn-primary">Save availability</button>
        </form>
      ) : (
        <p className="card mt-6 p-6">Create your provider profile first.</p>
      )}
    </>
  );
}
