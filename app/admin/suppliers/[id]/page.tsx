import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBanner } from "@/components/supplier/StatusBanner";
import { SupplierActionsPanel } from "@/components/admin/suppliers/SupplierActionsPanel";
import { SupplierDocumentList } from "@/components/admin/suppliers/SupplierDocumentList";
import { createClient } from "@/lib/supabase/server";
import {
  getSupplierOnboardingBundle,
  getSupplierReviewEvents,
  getSupplierReviewNotes,
} from "@/lib/supplier/data";
import { BRANCH_TYPE_LABELS } from "@/lib/supplier/constants";
import type { SupplierOrganisation } from "@/lib/supplier/types";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { SupplierTradingControls } from "@/components/admin/suppliers/SupplierTradingControls";
import { startSupplierPreview } from "../actions";
import { RecordList } from "@/components/admin/RecordList";
import { SupplierDetailTabs } from "@/components/admin/suppliers/SupplierDetailTabs";

export default async function AdminSupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: organisation } = await supabase
    .from("organisations")
    .select(
      "id, name, organisation_type, registration_number, tax_id, verification_status, verification_levels, decision_reason, suspended_reason, submitted_at, reviewed_at, approved_at, suspended_at, reviewer_id,account_status,product_publishing_enabled,order_acceptance_enabled,settlement_hold,settlement_hold_reason,created_by",
    )
    .eq("id", id)
    .eq("organisation_type", "supplier")
    .maybeSingle();

  if (!organisation) notFound();
  const org = organisation as SupplierOrganisation;
  // Refresh only this supplier on drill-down; the list remains fast and uses the latest stored score.
  await supabase.rpc("admin_refresh_supplier_performance", {
    target_supplier: id,
  });

  const [
    bundle,
    events,
    notes,
    { data: reviewers },
    { data: listings },
    { data: orders },
    { data: quotes },
    { data: deliveries },
    { data: reviews },
    { data: disputes },
    { data: staff },
    { data: metrics },
    { data: ledger },
    { data: maskedSettlement },
    { data: adminActions },
    { count: availableRfqCount },
    { data: owner },
  ] = await Promise.all([
    getSupplierOnboardingBundle(supabase, id),
    getSupplierReviewEvents(supabase, id),
    getSupplierReviewNotes(supabase, id),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["admin", "super_admin"]),
    supabase
      .from("supplier_listings")
      .select(
        "id,is_active,stock_status,stock_quantity,updated_at,products(name)",
      )
      .eq("supplier_id", id),
    supabase
      .from("orders")
      .select("id,order_number,status,total,service_fee,created_at")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("supplier_quotes")
      .select("id,status,total,created_at,quote_requests(created_at)")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("deliveries")
      .select("id,status,delivered_at,created_at,orders!inner(supplier_id)")
      .eq("orders.supplier_id", id),
    supabase
      .from("reviews")
      .select("id,rating,comment,created_at")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("order_disputes")
      .select("id,status,reason,created_at,orders!inner(supplier_id)")
      .eq("orders.supplier_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("organisation_members")
      .select("user_id,member_role,is_active,profiles(full_name,phone)")
      .eq("organisation_id", id),
    supabase
      .from("supplier_performance_metrics")
      .select("*")
      .eq("supplier_id", id)
      .maybeSingle(),
    supabase
      .from("supplier_ledger_entries")
      .select("id,amount,status,description,created_at")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false }),
    supabase.rpc("admin_masked_supplier_settlement", { target_supplier: id }),
    supabase
      .from("admin_action_history")
      .select("id,action,reason,created_at,actor_id")
      .eq("subject_type", "supplier")
      .eq("subject_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("quote_requests")
      .select("id", { head: true, count: "exact" })
      .eq("status", "open"),
    supabase
      .from("profiles")
      .select("full_name,phone")
      .eq("id", organisation.created_by)
      .maybeSingle(),
  ]);

  const profile = bundle.profile;

  return (
    <DashboardShell title="Platform administration" nav={[...ADMIN_NAV]}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">{org.name}</h1>
          <p className="mt-1 text-slate-600">Supplier application review</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <form action={startSupplierPreview.bind(null, id)}>
            <label>
              <span className="label">Preview reason</span>
              <input className="input" name="reason" minLength={5} required />
            </label>
            <button className="btn-secondary mt-2">
              View supplier dashboard
            </button>
          </form>
          <Link href="/admin/suppliers" className="btn-secondary">
            Back to list
          </Link>
        </div>
      </div>

      <SupplierDetailTabs initialTab={["submitted", "under_review", "information_required"].includes(org.verification_status) ? "verification" : "business"} />

      <div className="mt-6 scroll-mt-24" id="supplier-panel-verification" role="tabpanel" aria-labelledby="supplier-tab-verification" data-supplier-tab="verification">
        <StatusBanner
          status={org.verification_status}
          reason={org.decision_reason ?? org.suspended_reason}
          showAction={false}
          audience="admin"
        />
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
          <Stat
            label="Submitted"
            value={
              organisation.submitted_at
                ? new Date(organisation.submitted_at).toLocaleDateString()
                : "—"
            }
          />
          <Stat
            label="Reviewed"
            value={
              organisation.reviewed_at
                ? new Date(organisation.reviewed_at).toLocaleDateString()
                : "—"
            }
          />
          <Stat
            label="Approved"
            value={
              organisation.approved_at
                ? new Date(organisation.approved_at).toLocaleDateString()
                : "—"
            }
          />
          <Stat
            label="Verification levels"
            value={
              (organisation.verification_levels ?? []).join(", ") || "None"
            }
          />
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6" id="supplier-panel-business" role="tabpanel" data-supplier-tab="business">
            <h2 className="text-lg font-bold">Business</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Trading name" value={profile?.trading_name} />
              <Row label="Business type" value={profile?.business_type} />
              <Row
                label="Registration number"
                value={org.registration_number}
              />
              <Row label="TIN" value={org.tax_id} />
              <Row
                label="VAT registered"
                value={profile?.vat_registered ? "Yes" : "No"}
              />
              <Row
                label="Year established"
                value={profile?.year_established?.toString()}
              />
              <Row
                label="Categories"
                value={profile?.primary_categories?.join(", ")}
              />
              <Row label="Website" value={profile?.website} />
            </dl>
            <p className="mt-3 text-sm text-slate-600">
              {profile?.business_description}
            </p>
          </section>

          <section className="card p-6" id="supplier-panel-inventory" role="tabpanel" data-supplier-tab="inventory">
            <h2 className="text-lg font-bold">Products and inventory</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Total products" value={listings?.length ?? 0} />
              <Stat
                label="Active"
                value={listings?.filter((x) => x.is_active).length ?? 0}
              />
              <Stat
                label="Draft / suspended"
                value={listings?.filter((x) => !x.is_active).length ?? 0}
              />
              <Stat
                label="Out of stock"
                value={
                  listings?.filter((x) => x.stock_status === "out_of_stock")
                    .length ?? 0
                }
              />
              <Stat
                label="Low stock"
                value={
                  listings?.filter((x) => x.stock_status === "low_stock")
                    .length ?? 0
                }
              />
              <Stat
                label="Stock update score"
                value={`${Number(metrics?.stock_update_score ?? 0).toFixed(1)}%`}
              />
            </div>
          </section>

          <section className="card p-6" id="supplier-panel-commerce" role="tabpanel" data-supplier-tab="commerce">
            <h2 className="text-lg font-bold">Orders and quotations</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Quotes submitted" value={quotes?.length ?? 0} />
              <Stat
                label="Quotations received / available"
                value={availableRfqCount ?? 0}
              />
              <Stat
                label="Quote win rate"
                value={`${quotes?.length ? ((quotes.filter((x) => x.status === "accepted").length / quotes.length) * 100).toFixed(1) : 0}%`}
              />
              <Stat label="Orders" value={orders?.length ?? 0} />
              <Stat
                label="Orders accepted"
                value={
                  orders?.filter(
                    (x) =>
                      ![
                        "draft",
                        "awaiting_payment",
                        "awaiting_supplier_confirmation",
                        "cancelled",
                      ].includes(x.status),
                  ).length ?? 0
                }
              />
              <Stat
                label="Orders rejected / cancelled"
                value={
                  orders?.filter((x) => x.status === "cancelled").length ?? 0
                }
              />
              <Stat
                label="Average response score"
                value={`${Number(metrics?.quotation_response_score ?? 0).toFixed(1)}/100`}
              />
              <Stat
                label="Completed"
                value={
                  orders?.filter((x) => x.status === "completed").length ?? 0
                }
              />
              <Stat
                label="Cancelled"
                value={
                  orders?.filter((x) => x.status === "cancelled").length ?? 0
                }
              />
              <Stat
                label="Gross sales"
                value={`GHS ${(orders ?? [])
                  .filter((x) => !["cancelled", "refunded"].includes(x.status))
                  .reduce((n, x) => n + Number(x.total), 0)
                  .toFixed(2)}`}
              />
            </div>
          </section>

          <section className="card p-6" id="supplier-panel-delivery" role="tabpanel" data-supplier-tab="delivery">
            <h2 className="text-lg font-bold">Delivery performance</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Deliveries" value={deliveries?.length ?? 0} />
              <Stat
                label="Completed"
                value={
                  deliveries?.filter((x) => x.status === "delivered").length ??
                  0
                }
              />
              <Stat
                label="Late / failed"
                value={
                  deliveries?.filter((x) =>
                    ["late", "failed"].includes(x.status),
                  ).length ?? 0
                }
              />
              <Stat
                label="Partial"
                value={
                  deliveries?.filter((x) => x.status === "partially_delivered")
                    .length ?? 0
                }
              />
              <Stat label="Delivery disputes" value={disputes?.length ?? 0} />
              <Stat
                label="On-time rate"
                value={`${Number(metrics?.on_time_rate ?? 0).toFixed(1)}%`}
              />
            </div>
          </section>

          <section className="card p-6" data-supplier-tab="delivery">
            <h2 className="text-lg font-bold">Performance score</h2>
            <p className="mt-2 text-3xl font-black capitalize">
              {Number(metrics?.score ?? 0).toFixed(1)} ·{" "}
              {(metrics?.rating ?? "not calculated").replaceAll("_", " ")}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Order acceptance", metrics?.acceptance_time_score],
                ["Quotation response", metrics?.quotation_response_score],
                ["Fulfilment", metrics?.fulfilment_rate],
                ["Cancellation", 100 - Number(metrics?.cancellation_rate ?? 0)],
                ["Return", 100 - Number(metrics?.return_rate ?? 0)],
                ["Dispute", 100 - Number(metrics?.dispute_rate ?? 0)],
                ["On-time delivery", metrics?.on_time_rate],
                ["Customer rating", Number(metrics?.average_rating ?? 0) * 20],
                ["Stock updates", metrics?.stock_update_score],
                ["Product accuracy", metrics?.product_accuracy_score],
              ].map(([label, value]) => (
                <div
                  className="flex justify-between border-b py-2 text-sm"
                  key={String(label)}
                >
                  <span>{label}</span>
                  <b>{Number(value ?? 0).toFixed(1)}/100</b>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Calculated from operational records; no unaudited manual override
              is available.
            </p>
          </section>

          <section className="card p-6" id="supplier-panel-financial" role="tabpanel" data-supplier-tab="financial">
            <h2 className="text-lg font-bold">Financial summary</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat
                label="Gross sales"
                value={`GHS ${(orders ?? [])
                  .filter((x) => !["cancelled", "refunded"].includes(x.status))
                  .reduce((n, x) => n + Number(x.total), 0)
                  .toFixed(2)}`}
              />
              <Stat
                label="Platform commission"
                value={`GHS ${(orders ?? []).reduce((n, x) => n + Number(x.service_fee), 0).toFixed(2)}`}
              />
              <Stat
                label="Pending settlements"
                value={`GHS ${(ledger ?? [])
                  .filter((x) => ["pending", "available"].includes(x.status))
                  .reduce((n, x) => n + Number(x.amount), 0)
                  .toFixed(2)}`}
              />
              <Stat
                label="Completed settlements"
                value={`GHS ${(ledger ?? [])
                  .filter((x) => x.status === "paid")
                  .reduce((n, x) => n + Number(x.amount), 0)
                  .toFixed(2)}`}
              />
              <Stat
                label="Settlement status"
                value={organisation.settlement_hold ? "held" : "available"}
              />
              <Stat
                label="Refunded orders"
                value={
                  orders?.filter((x) => x.status === "refunded").length ?? 0
                }
              />
            </div>
            <h3 className="mt-5 font-semibold">Settlement history</h3>
            <RecordList
              records={(ledger ?? []) as unknown as Record<string, unknown>[]}
            />
          </section>

          <section className="card p-6" id="supplier-panel-reviews" role="tabpanel" data-supplier-tab="reviews">
            <h2 className="text-lg font-bold">Reviews and disputes</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat
                label="Average rating"
                value={Number(metrics?.average_rating ?? 0).toFixed(1)}
              />
              <Stat label="Reviews" value={reviews?.length ?? 0} />
              <Stat
                label="Open disputes"
                value={
                  disputes?.filter((x) =>
                    ["open", "under_review"].includes(x.status),
                  ).length ?? 0
                }
              />
              <Stat
                label="Resolved disputes"
                value={
                  disputes?.filter((x) =>
                    ["resolved", "rejected", "refunded"].includes(x.status),
                  ).length ?? 0
                }
              />
              <Stat
                label="Return rate"
                value={`${Number(metrics?.return_rate ?? 0).toFixed(1)}%`}
              />
              <Stat
                label="Complaint rate"
                value={`${Number(metrics?.dispute_rate ?? 0).toFixed(1)}%`}
              />
            </div>
            {reviews?.slice(0, 5).map((x) => (
              <div className="border-t py-3 text-sm" key={x.id}>
                <b>{x.rating}/5</b> {x.comment ?? "No written review"}
              </div>
            ))}
            <h3 className="mt-5 font-semibold">Dispute history</h3>
            <RecordList
              records={(disputes ?? []) as unknown as Record<string, unknown>[]}
            />
          </section>

          <section className="card p-6" id="supplier-panel-staff" role="tabpanel" data-supplier-tab="staff">
            <h2 className="text-lg font-bold">Staff</h2>
            <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm">
              <b>Supplier owner</b>
              <p>
                {owner?.full_name ?? "—"} · {owner?.phone ?? "No phone"}
              </p>
            </div>
            {staff?.map((x) => (
              <div
                className="flex justify-between border-b py-3 text-sm"
                key={x.user_id}
              >
                <span>
                  {(x.profiles as unknown as { full_name: string } | null)
                    ?.full_name ?? "Member"}
                </span>
                <span className="capitalize">
                  {x.member_role.replaceAll("_", " ")} ·{" "}
                  {x.is_active ? "active" : "inactive"}
                </span>
              </div>
            ))}
            {!staff?.length && (
              <p className="mt-3 text-slate-500">No staff memberships.</p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Staff roles are displayed read-only here; preview mode cannot
              modify them.
            </p>
          </section>

          <section className="card p-6" data-supplier-tab="business">
            <h2 className="text-lg font-bold">Contact</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Contact name" value={profile?.primary_contact_name} />
              <Row label="Phone" value={profile?.primary_phone} />
              <Row
                label="Alternative phone"
                value={profile?.alternative_phone}
              />
              <Row label="Email" value={profile?.business_email} />
              <Row label="WhatsApp" value={profile?.whatsapp_number} />
              <Row label="Address" value={profile?.physical_address} />
              <Row
                label="Region / City"
                value={[profile?.city, profile?.region]
                  .filter(Boolean)
                  .join(", ")}
              />
              <Row label="GhanaPost GPS" value={profile?.ghanapost_gps} />
            </dl>
          </section>

          <section className="card p-6" id="supplier-panel-branches" role="tabpanel" data-supplier-tab="branches">
            <h2 className="text-lg font-bold">
              Branches ({bundle.branches.length})
            </h2>
            <div className="mt-3 space-y-2">
              {bundle.branches.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-slate-200 p-3 text-sm"
                >
                  <p className="font-semibold">
                    {b.name} {b.is_main_branch && "(main)"}
                  </p>
                  <p className="text-slate-600">
                    {BRANCH_TYPE_LABELS[b.branch_type]} • {b.address}, {b.city},{" "}
                    {b.region}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Contact: {b.contact_person ?? "—"} · {b.phone ?? "No phone"}{" "}
                    · Pickup:{" "}
                    {b.supports_pickup ? "available" : "not available"} · Hours:{" "}
                    {b.operating_hours ?? "not supplied"}
                  </p>
                </div>
              ))}
              {bundle.branches.length === 0 && (
                <p className="text-sm text-slate-500">No branches submitted.</p>
              )}
            </div>
          </section>

          <section className="card p-6" data-supplier-tab="financial">
            <h2 className="text-lg font-bold">Settlement</h2>
            <p className="mt-2 text-sm text-slate-600">
              {(maskedSettlement as { configured?: boolean } | null)?.configured
                ? `Bank account ${(maskedSettlement as { account_number_masked?: string }).account_number_masked || "on file"}, mobile money ${(maskedSettlement as { momo_number_masked?: string }).momo_number_masked || "on file"}.`
                : "Not provided yet."}
            </p>
          </section>

          <section className="card p-6" id="supplier-panel-verification" role="tabpanel" data-supplier-tab="verification">
            <h2 className="text-lg font-bold">Documents</h2>
            <div className="mt-3">
              <SupplierDocumentList documents={bundle.documents} />
            </div>
          </section>

          <section className="card p-6" data-supplier-tab="verification">
            <h2 className="text-lg font-bold">Review history</h2>
            <div className="mt-3 space-y-3 text-sm">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="border-b border-slate-100 pb-3 last:border-0"
                >
                  <p className="font-semibold">
                    {event.event_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-slate-500">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                  {event.reason && (
                    <p className="mt-1 text-slate-700">
                      Reason: {event.reason}
                    </p>
                  )}
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-slate-500">No review activity yet.</p>
              )}
            </div>
          </section>

          <section className="card p-6" data-supplier-tab="verification">
            <h2 className="text-lg font-bold">Internal notes</h2>
            <div className="mt-3 space-y-3 text-sm">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="border-b border-slate-100 pb-3 last:border-0"
                >
                  <p>{n.note}</p>
                  <p className="mt-1 text-slate-500">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-slate-500">No internal notes yet.</p>
              )}
            </div>
          </section>
          <section className="card p-6" data-supplier-tab="verification">
            <h2 className="text-lg font-bold">Administrative audit history</h2>
            <RecordList
              records={
                (adminActions ?? []) as unknown as Record<string, unknown>[]
              }
            />
          </section>
        </div>

        <div className="space-y-6" data-supplier-tab="verification">
          <SupplierActionsPanel
            organisationId={org.id}
            status={org.verification_status}
            currentVerificationLevels={org.verification_levels}
            reviewers={(reviewers ?? []) as { id: string; full_name: string }[]}
            currentReviewerId={org.reviewer_id}
          />
          <SupplierTradingControls
            id={id}
            accountStatus={String(organisation.account_status)}
            publishing={Boolean(organisation.product_publishing_enabled)}
            orders={Boolean(organisation.order_acceptance_enabled)}
            settlementHold={Boolean(organisation.settlement_hold)}
          />
        </div>
      </div>
    </DashboardShell>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="contents">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <b className="mt-1 block capitalize">{value}</b>
    </div>
  );
}
