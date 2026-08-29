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
