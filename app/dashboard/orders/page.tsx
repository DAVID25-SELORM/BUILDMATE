import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerOrdersView } from "@/components/dashboard/PortalSectionViews";
import { requireUser } from "@/lib/auth/session";
import { getCustomerOrganisationMembership } from "@/lib/organisations/access";
import { customerNavigation } from "@/lib/organisations/navigation";
import { getCustomerOrders } from "@/lib/orders/customer";

export default async function OrdersPage() {
  const { user } = await requireUser();
  const { membership } = await getCustomerOrganisationMembership();
  const organisationId = membership?.organisation_id;
  const orders = await getCustomerOrders({ userId: user.id, organisationId });
  return (
    <DashboardShell
      title="Customer workspace"
      nav={await customerNavigation(organisationId)}
    >
      <CustomerOrdersView orders={orders} />
    </DashboardShell>
  );
}
