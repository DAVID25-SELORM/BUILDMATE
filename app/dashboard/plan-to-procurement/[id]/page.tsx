import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireUser } from "@/lib/auth/session";
import { localDateValue } from "@/lib/dates/future";
import { getCustomerOrganisationMembership } from "@/lib/organisations/access";
import { customerNavigation } from "@/lib/organisations/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProcurementRfq, updateProcurementItem } from "./actions";
export default async function ProcurementReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params,
    s = await createClient(),
    { membership } = await getCustomerOrganisationMembership(),
    [{ data: upload }, { data: items }, { data: products }] = await Promise.all(
      [
        s
          .from("project_procurement_uploads")
          .select("id,title,original_filename,status,current_stage,source_type")
          .eq("id", id)
          .maybeSingle(),
        s
          .from("procurement_upload_items")
          .select(
            "id,source_sheet,source_row,description,quantity,unit,matched_product_id,match_confidence,review_status",
          )
          .eq("upload_id", id)
          .order("source_sheet")
          .order("source_row"),
        s
          .from("products")
          .select("id,name,base_unit")
          .eq("is_active", true)
          .order("name")
          .limit(1000),
      ],
    );
  if (!upload) notFound();
  const confirmed =
    items?.filter((x) => x.review_status === "confirmed").length ?? 0;
  return (
    <DashboardShell
      title="Customer workspace"
      nav={await customerNavigation(membership?.organisation_id)}
    >
      <Link
        href="/dashboard/plan-to-procurement"
        className="text-sm font-semibold text-brand-700"
      >
        ← All uploads
      </Link>
      <h1 className="mt-3 text-3xl font-black">Review extracted BOQ</h1>
      <p className="mt-2 text-slate-600">
        {upload.title} · {upload.original_filename}
      </p>
      <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        <b>Customer confirmation required.</b> BuildMate preserves source sheet
        and row, but does not certify quantities. Check the document or consult
        a qualified quantity surveyor before confirming.
      </div>
      <div className="mt-6 space-y-4">
        {(items ?? []).map((item) => (
          <form
            action={updateProcurementItem.bind(null, id, item.id)}
            className="card grid gap-3 p-4 lg:grid-cols-[110px_2fr_120px_110px_1.4fr_130px_auto] lg:items-end"
            key={item.id}
          >
            <div className="text-xs text-slate-500">
              <span className="label">Source</span>
              {item.source_sheet}
              <br />
              Row {item.source_row}
            </div>
            <label>
              <span className="label">Description</span>
              <input
                className="input"
                name="description"
                defaultValue={item.description}
                required
              />
            </label>
            <label>
              <span className="label">Quantity</span>
              <input
                className="input"
                name="quantity"
                type="number"
                min="0.001"
                step="any"
                defaultValue={item.quantity}
                required
              />
            </label>
            <label>
              <span className="label">Unit</span>
              <input
                className="input"
                name="unit"
                defaultValue={item.unit}
                required
              />
            </label>
            <label>
              <span className="label">
                Catalogue match{" "}
                {item.match_confidence
                  ? `(${Math.round(Number(item.match_confidence) * 100)}%)`
                  : ""}
              </span>
              <select
                className="input"
                name="productId"
                defaultValue={item.matched_product_id ?? ""}
              >
                <option value="">No confirmed match</option>
                {(products ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} / {p.base_unit}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Review</span>
              <select
                className="input"
                name="reviewStatus"
                defaultValue={item.review_status}
              >
                <option value="extracted">Needs review</option>
                <option value="confirmed">Confirmed</option>
                <option value="excluded">Exclude</option>
              </select>
            </label>
            <button className="btn-secondary">Save</button>
          </form>
        ))}
        {!items?.length && (
          <div className="card p-8 text-center text-slate-500">
            No structured rows are available. PDF plans and images remain in
            assisted review.
          </div>
        )}
      </div>
      {!!items?.length && (
        <form
          action={createProcurementRfq.bind(null, id)}
          className="card mt-8 p-6"
        >
          <h2 className="text-xl font-black">
            Create supplier quotation request
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {confirmed} of {items.length} rows confirmed. Only confirmed rows
            will be sent.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_220px_auto]">
            <label>
              <span className="label">Delivery location</span>
              <input className="input" name="location" required minLength={3} />
            </label>
            <label>
              <span className="label">Required date</span>
              <input
                className="input"
                name="requiredDate"
                type="date"
                min={localDateValue()}
                required
              />
            </label>
            <button className="btn-primary self-end" disabled={!confirmed}>
              Create RFQ
            </button>
          </div>
        </form>
      )}
    </DashboardShell>
  );
}
