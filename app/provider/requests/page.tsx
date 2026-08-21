import { progressServiceRequest } from "@/app/services/actions";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function ProviderRequests({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const q = await searchParams;
  const { user } = await requireUser();
  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("service_provider_profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: requests } = provider
    ? await supabase
        .from("service_requests")
        .select(
          "id,request_number,title,description,region,city,preferred_at,budget,status,provider_message,created_at,service_categories(name),profiles!service_requests_customer_id_fkey(full_name)",
        )
        .eq("provider_id", provider.id)
        .order("created_at", { ascending: false })
    : { data: [] };
  return (
    <>
      <h1 className="text-3xl font-black">Service requests</h1>
      <p className="mt-2 text-slate-600">
        Respond, reschedule and progress work from one auditable queue.
      </p>
      {q.error && (
        <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">{q.error}</p>
      )}
      <div className="mt-6 space-y-4">
        {requests?.map((request) => (
          <article className="card p-5" key={request.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-brand-700">
                  {request.request_number}
                </p>
                <h2 className="text-xl font-bold">{request.title}</h2>
                <p className="text-sm text-slate-500">
                  {
                    (
                      request.service_categories as unknown as {
                        name: string;
                      } | null
                    )?.name
                  }{" "}
                  · {[request.city, request.region].filter(Boolean).join(", ")}
                </p>
              </div>
              <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">
                {request.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-700">{request.description}</p>
            <p className="mt-2 text-sm">
              Preferred:{" "}
              {request.preferred_at
                ? new Date(request.preferred_at).toLocaleString()
                : "Flexible"}
              {request.budget
                ? ` · Budget GHS ${Number(request.budget).toFixed(2)}`
                : ""}
            </p>
            {!["completed", "rejected", "cancelled"].includes(
              request.status,
            ) && (
              <form
                action={progressServiceRequest.bind(null, request.id)}
                className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_220px_auto]"
              >
                <select className="input" name="status" required>
                  <option value="viewed">Mark viewed</option>
                  <option value="accepted">Accept</option>
                  <option value="rescheduled">Propose new time</option>
                  {request.status === "accepted" && (
                    <option value="in_progress">Start work</option>
                  )}
                  {request.status === "in_progress" && (
                    <option value="completed">Complete</option>
                  )}
                  <option value="rejected">Reject</option>
                </select>
                <input
                  className="input"
                  name="message"
                  placeholder="Message or rejection reason"
                />
                <input
                  className="input"
                  type="datetime-local"
                  name="proposedAt"
                />
                <button className="btn-primary">Update</button>
              </form>
            )}
          </article>
        ))}
        {!requests?.length && (
          <div className="card p-8 text-center text-slate-500">
            No service requests yet.
          </div>
        )}
      </div>
    </>
  );
}
