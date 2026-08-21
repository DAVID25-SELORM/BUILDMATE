import { notFound } from "next/navigation";
import { PortalPreviewShell } from "@/components/admin/PortalPreviewShell";
import { CustomerOverview } from "@/components/dashboard/CustomerOverview";
import {
  CustomerOrdersView,
  CustomerQuotesView,
  type CustomerOrderView,
  type CustomerQuoteView,
} from "@/components/dashboard/PortalSectionViews";
import { requirePortalPreview } from "@/lib/admin/portal-preview";

type CustomerData = {
  profile: { full_name?: string };
  orders: CustomerOrderView[];
  quotes: CustomerQuoteView[];
  projects: unknown[];
};

export default async function CustomerPortalPreview({
  params,
}: {
  params: Promise<{ id: string; section?: string[] }>;
}) {
  const { id, section: segments } = await params;
  const section = segments?.[0] ?? "overview";
  if (!["overview", "orders", "quotes"].includes(section)) notFound();
  const { supabase, session } = await requirePortalPreview("customer", id, `/admin/preview/customer/${id}/${section}`);
  const { data, error } = await supabase.rpc("admin_customer_detail", {
    target_customer: id,
  });
  if (error || !data) notFound();
  const customer = data as unknown as CustomerData;
  const content =
    section === "orders" ? (
      <CustomerOrdersView orders={customer.orders} readOnly />
    ) : section === "quotes" ? (
      <CustomerQuotesView requests={customer.quotes} readOnly />
    ) : (
      <CustomerOverview
        projects={customer.projects.length}
        openQuotes={
          customer.quotes.filter((quote) => quote.status === "open").length
        }
        orders={customer.orders}
      />
    );
  return (
    <PortalPreviewShell
      portalType="customer"
      targetId={id}
      targetName={customer.profile.full_name ?? "Customer"}
      reason={session.reason}
      referenceNumber={session.reference_number}
      nav={[
        { label: "Overview" },
        { label: "Orders", section: "orders" },
        { label: "Quotations", section: "quotes" },
      ]}
    >
      {content}
    </PortalPreviewShell>
  );
}
