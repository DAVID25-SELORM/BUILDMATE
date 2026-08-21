import Link from "next/link";
import { customerProgressServiceRequest } from "@/app/services/actions";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const q = await searchParams;
  const { user } = await requireUser();
  const s = await createClient();
  const { data } = await s
    .from("service_requests")
    .select(
      "id,request_number,title,status,preferred_at,provider_message,created_at,service_categories(name),service_provider_profiles(display_name)",
    )
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });
  return (
    <main className="container-shell py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">My service requests</h1>
          <p className="mt-2 text-slate-600">
            Track every professional request from submission through completion.
          </p>
        </div>
        <Link className="btn-primary" href="/services">
          Find a professional
        </Link>
      </div>
      {q.created && (
        <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-800">
          Your request was sent successfully.
        </p>
      )}
      {q.error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{q.error}</p>
      )}
      <div className="card mt-6 divide-y">
        {data?.map((r) => (
          <article className="p-5" key={r.id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-brand-700">
                  {r.request_number}
                </p>
                <h2 className="font-bold">{r.title}</h2>
                <p className="text-sm text-slate-500">
                  {
                    (r.service_categories as unknown as { name: string } | null)
                      ?.name
                  }{" "}
                  ·{" "}
                  {
                    (
                      r.service_provider_profiles as unknown as {
                        display_name: string;
                      } | null
                    )?.display_name
                  }
                </p>
              </div>
              <span className="h-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">
                {r.status.replaceAll("_", " ")}
              </span>
            </div>
            {r.provider_message && (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                Provider message: {r.provider_message}
              </p>
            )}
            {r.status === "rescheduled" && (
              <form
                className="mt-3"
                action={customerProgressServiceRequest.bind(null, r.id)}
              >
                <input type="hidden" name="action" value="accept_reschedule" />
                <button className="btn-primary">Accept proposed time</button>
              </form>
            )}
            {["requested", "viewed", "accepted", "rescheduled"].includes(
              r.status,
            ) && (
              <form
                className="mt-3 flex gap-2"
                action={customerProgressServiceRequest.bind(null, r.id)}
              >
                <input type="hidden" name="action" value="cancel" />
                <input
                  className="input"
                  name="reason"
                  placeholder="Cancellation reason (optional)"
                />
                <button className="btn-secondary">Cancel request</button>
              </form>
            )}
          </article>
        ))}
        {!data?.length && (
          <div className="p-8 text-center text-slate-500">
            You have no service requests yet.
          </div>
        )}
      </div>
    </main>
  );
}
