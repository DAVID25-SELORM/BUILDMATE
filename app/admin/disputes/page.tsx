import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { resolveDispute } from "./actions";
import { ADMIN_NAV } from "@/lib/admin/navigation";
export default async function DisputesPage() {
  const s = await createClient();
  const { data } = await s
    .from("order_disputes")
    .select("id,reason,status,created_at,orders(order_number,total)")
    .order("created_at", { ascending: false });
  return (
    <DashboardShell
      title="Platform administration"
      nav={[...ADMIN_NAV]}
    >
      <h1 className="text-3xl font-black">Order disputes</h1>
      <p className="mt-2 text-slate-600">
        Refund outcomes require a verified provider refund reference.
      </p>
      <div className="mt-6 space-y-4">
        {(data ?? []).map((d) => {
          const order = d.orders as unknown as {
            order_number: string;
            total: number;
          } | null;
          return (
            <article className="card p-5" key={d.id}>
              <div className="flex justify-between gap-4">
                <div>
                  <b>{order?.order_number}</b>
                  <p className="mt-2 text-sm">{d.reason}</p>
                </div>
                <span className="capitalize">
                  {d.status.replaceAll("_", " ")}
                </span>
              </div>
              {["open", "under_review"].includes(d.status) && (
                <form
                  action={resolveDispute}
                  className="mt-4 grid gap-3 md:grid-cols-2"
                >
                  <input type="hidden" name="id" value={d.id} />
                  <select className="input" name="outcome" required>
                    <option value="resolved">Resolve for customer</option>
                    <option value="rejected">Reject claim</option>
                    <option value="refunded">Refund recorded</option>
                  </select>
                  <input
                    className="input"
                    name="reference"
                    placeholder="Provider refund reference (required for refund)"
                  />
                  <textarea
                    className="input md:col-span-2"
                    name="notes"
                    placeholder="Resolution notes"
                    required
                  />
                  <button className="btn-primary md:col-span-2">
                    Record outcome
                  </button>
                </form>
              )}
            </article>
          );
        })}
        {!data?.length && (
          <div className="card p-8 text-center text-slate-500">
            No disputes.
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
