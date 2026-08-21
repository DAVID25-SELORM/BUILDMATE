import { hasPermission } from "@/lib/auth/permissions";

export const customerCoreNavigation = [
  { label: "Home", href: "/dashboard" },
  { label: "Shop", href: "/shop" },
  { label: "Categories", href: "/#categories" },
  { label: "Projects", href: "/dashboard/plan-to-procurement" },
  { label: "Orders", href: "/dashboard/orders" },
  { label: "Quotations", href: "/dashboard/quotes" },
  { label: "Services", href: "/dashboard/services" },
  { label: "Account", href: "/dashboard/account" },
  { label: "Support", href: "/support" },
] as const;

export async function supplierNavigation(organisationId: string) {
  const checks = await Promise.all(
    [
      "orders.view",
      "quotations.view",
      "products.view",
      "inventory.view",
      "reports.inventory",
      "settlements.view",
      "supplier.staff.view",
      "supplier.profile.edit",
    ].map((permission) => hasPermission({ permission, organisationId })),
  );
  return [
    { label: "Overview", href: "/supplier" },
    checks[0] && { label: "Orders", href: "/supplier/orders" },
    checks[1] && { label: "Quotation requests", href: "/supplier/quotes" },
    checks[2] && { label: "Products", href: "/supplier/products" },
    checks[3] && { label: "Inventory", href: "/supplier/inventory" },
    checks[4] && {
      label: "Inventory reports",
      href: "/supplier/inventory/reports",
    },
    checks[5] && { label: "Settlements", href: "/supplier/settlements" },
    checks[6] && { label: "Staff", href: "/supplier/staff" },
    checks[7] && { label: "Organisation settings", href: "/supplier/settings" },
    { label: "Support", href: "/support" },
  ].filter(Boolean) as { label: string; href: string }[];
}
export async function customerNavigation(organisationId?: string) {
  const [organisation, manage, requestCreate, requestApprove] = organisationId
    ? await Promise.all([
        hasPermission({ permission: "organisation.view", organisationId }),
        hasPermission({ permission: "organisation.manage", organisationId }),
        hasPermission({
          permission: "purchase_requests.create",
          organisationId,
        }),
        hasPermission({
          permission: "purchase_requests.approve",
          organisationId,
        }),
      ])
    : [false, false, false, false];
  return [
    ...customerCoreNavigation.slice(0, 7),
    (requestCreate || requestApprove) && {
      label:
        requestApprove && !requestCreate ? "Approvals" : "Purchase requests",
      href: "/dashboard/organisation/purchase-requests",
    },
    organisation && { label: "Team", href: "/dashboard/organisation/staff" },
    manage && {
      label: "Account settings",
      href: "/dashboard/organisation/settings",
    },
    ...customerCoreNavigation.slice(7),
  ].filter(Boolean) as { label: string; href: string }[];
}
