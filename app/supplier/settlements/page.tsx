import { SupplierSettlementsView } from "@/components/dashboard/PortalSectionViews";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { settlementBalance } from "@/lib/settlements/reconciliation";

export default async function Settlements() {
  const { supabase, membership } = await requireSupplierPermission("settlements.view");
  const { data } = await supabase.from("supplier_ledger_entries").select("id,entry_type,amount,status,description,created_at,settled_at").eq("supplier_id", membership.organisationId).order("created_at", { ascending: false });
  const rows = (data ?? []).map((entry) => ({ ...entry, amount: Number(entry.amount) }));
  return <SupplierSettlementsView entries={rows} balance={settlementBalance(rows)} />;
}
