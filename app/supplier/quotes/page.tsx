import { SupplierQuotesView } from "@/components/dashboard/PortalSectionViews";
import { requireSupplierPermission } from "@/lib/organisations/access";

export default async function SupplierQuotesPage() {
  const { supabase } = await requireSupplierPermission("quotations.view");
  const { data } = await supabase.from("quote_requests").select("id,title,delivery_location,required_date,notes,created_at,quote_request_items(description,quantity,unit)").eq("status", "open").order("created_at", { ascending: false });
  return <SupplierQuotesView requests={data ?? []} />;
}
