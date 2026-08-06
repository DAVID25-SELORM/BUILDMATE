export const PLATFORM_ROLE_KEYS = [
  "super_admin",
  "operations_admin",
  "customer_support_admin",
  "supplier_verification_admin",
  "finance_admin",
  "catalogue_admin",
  "logistics_admin",
  "reports_admin",
  "audit_viewer",
  "platform_viewer"
] as const;
export type PlatformRoleKey = (typeof PLATFORM_ROLE_KEYS)[number];

export const PLATFORM_ROLE_LABELS: Record<PlatformRoleKey, string> = {
  super_admin: "Super Administrator",
  operations_admin: "Operations Administrator",
  customer_support_admin: "Customer Support Administrator",
  supplier_verification_admin: "Supplier Verification Administrator",
  finance_admin: "Finance Administrator",
  catalogue_admin: "Catalogue Administrator",
  logistics_admin: "Logistics Administrator",
  reports_admin: "Reports Administrator",
  audit_viewer: "Audit Viewer",
  platform_viewer: "Platform Viewer"
};

export const PLATFORM_PERMISSION_KEYS = [
  "platform.users.view",
  "platform.users.invite",
  "platform.users.manage_roles",
  "customers.view",
  "customers.suspend",
  "suppliers.view",
  "suppliers.verify",
  "suppliers.suspend",
  "catalogue.manage",
  "orders.manage",
  "deliveries.manage",
  "payments.view",
  "refunds.process",
  "settlements.view",
  "settlements.release",
  "reports.view",
  "audit_logs.view"
] as const;
export type PlatformPermissionKey = (typeof PLATFORM_PERMISSION_KEYS)[number];

export const PLATFORM_PERMISSION_LABELS: Record<PlatformPermissionKey, string> = {
  "platform.users.view": "View platform staff",
  "platform.users.invite": "Invite platform staff",
  "platform.users.manage_roles": "Manage platform staff roles and status",
  "customers.view": "View customers",
  "customers.suspend": "Suspend customers",
  "suppliers.view": "View suppliers",
  "suppliers.verify": "Verify suppliers",
  "suppliers.suspend": "Suspend suppliers",
  "catalogue.manage": "Manage catalogue",
  "orders.manage": "Manage orders",
  "deliveries.manage": "Manage deliveries",
  "payments.view": "View payments",
  "refunds.process": "Process refunds",
  "settlements.view": "View settlements",
  "settlements.release": "Release settlements",
  "reports.view": "View reports",
  "audit_logs.view": "View audit logs"
};

export const INVITATION_STATUS_LABELS = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked"
} as const;

export const MEMBERSHIP_STATUS_LABELS = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
  removed: "Removed"
} as const;
