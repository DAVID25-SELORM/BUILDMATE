import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SupplierFilterBar } from "@/components/admin/suppliers/SupplierFilterBar";
import { VERIFICATION_STATUS_LABELS, type VerificationStatus } from "@/lib/supplier/constants";
import { createClient } from "@/lib/supabase/server";

interface SupplierListRow {
  id: string;
  name: string;
  verification_status: VerificationStatus;
  submitted_at: string | null;
  reviewer_id: string | null;
}

export default async function AdminSuppliersPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "", q = "" } = await searchParams;
  const supabase = await createClient();

  let matchingIds: string[] | null = null;
  if (q) {
    const pattern = `%${q}%`;
    const [{ data: byOrgName }, { data: byContactName }, { data: byEmail }] = await Promise.all([
      supabase.from("organisations").select("id").eq("organisation_type", "supplier").ilike("name", pattern),
      supabase.from("supplier_profiles").select("organisation_id").ilike("primary_contact_name", pattern),
      supabase.from("supplier_profiles").select("organisation_id").ilike("business_email", pattern)
    ]);
    const ids = new Set<string>();
    (byOrgName ?? []).forEach((r) => ids.add(r.id));
    (byContactName ?? []).forEach((r) => ids.add(r.organisation_id));
    (byEmail ?? []).forEach((r) => ids.add(r.organisation_id));
    matchingIds = Array.from(ids);
  }

  let query = supabase
    .from("organisations")
    .select("id, name, verification_status, submitted_at, reviewer_id")
    .eq("organisation_type", "supplier")
    .order("submitted_at", { ascending: false, nullsFirst: false });

  if (status) query = query.eq("verification_status", status);
  if (matchingIds) query = query.in("id", matchingIds.length > 0 ? matchingIds : ["00000000-0000-0000-0000-000000000000"]);

  const { data: suppliers } = await query;
  const rows = (suppliers ?? []) as SupplierListRow[];

  return (
    <DashboardShell
      title="Platform administration"
      nav={["Overview", "Users", "Suppliers", "Catalogue", "Orders", "Quotes", "Payments", "Settlements", "Deliveries", "Disputes", "Reports", "Audit Log", "Settings"]}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black">Supplier applications</h1>
          <p className="mt-2 text-slate-600">Review, verify and manage supplier accounts.</p>
        </div>
        <Link href="/admin" className="btn-secondary">Back to overview</Link>
      </div>

      <div className="mt-6">
        <SupplierFilterBar currentStatus={status} currentQuery={q} />
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4">Supplier</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Reviewer</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b last:border-0" key={row.id}>
                <td className="p-4 font-semibold">{row.name}</td>
                <td>{VERIFICATION_STATUS_LABELS[row.verification_status]}</td>
                <td>{row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : "—"}</td>
                <td>{row.reviewer_id ? "Assigned" : "Unassigned"}</td>
                <td className="p-4 text-right">
                  <Link href={`/admin/suppliers/${row.id}`} className="font-semibold text-brand-700">Open</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">No supplier applications match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
