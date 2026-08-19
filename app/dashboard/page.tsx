import { CustomerOverview } from "@/components/dashboard/CustomerOverview";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCustomerOrganisationMembership } from "@/lib/organisations/access";
import { customerNavigation } from "@/lib/organisations/navigation";
import { getFeaturedProducts } from "@/lib/catalogue/featured-products";
import { getCustomerOrders } from "@/lib/orders/customer";
export default async function CustomerDashboard() {
  const { user } = await requireUser();
  const supabase = await createClient();
  const { membership } = await getCustomerOrganisationMembership();
  const organisationId = membership?.organisation_id;
  let projectsQuery = supabase
    .from("projects")
    .select("id", { count: "exact", head: true });
  let quotesQuery = supabase
    .from("quote_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (organisationId) {
    projectsQuery = projectsQuery.eq("organisation_id", organisationId);
    quotesQuery = quotesQuery.eq("organisation_id", organisationId);
  } else {
    projectsQuery = projectsQuery
      .eq("owner_id", user.id)
      .is("organisation_id", null);
    quotesQuery = quotesQuery
      .eq("requester_id", user.id)
      .is("organisation_id", null);
  }
  const [{ count: projects }, { count: quotes }, orders, products] =
    await Promise.all([
      projectsQuery,
      quotesQuery,
      getCustomerOrders({ userId: user.id, organisationId }),
      getFeaturedProducts(4),
    ]);
  return (
    <DashboardShell
      title="Customer workspace"
      nav={await customerNavigation(organisationId)}
    >
      <CustomerOverview
        projects={projects ?? 0}
        openQuotes={quotes ?? 0}
        orders={orders}
        products={products}
      />
    </DashboardShell>
  );
}
