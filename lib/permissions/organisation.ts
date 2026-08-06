export type OrganisationScope = "supplier" | "customer";

export const ORGANISATION_ROLE_LABELS = {
  supplier: {
    owner: "Owner", administrator: "Administrator", branch_manager: "Branch manager",
    sales_officer: "Sales officer", quotation_officer: "Quotation officer", inventory_officer: "Inventory officer",
    warehouse_officer: "Warehouse officer", finance_officer: "Finance officer", dispatch_officer: "Dispatch officer",
    customer_service_officer: "Customer service officer", viewer: "Viewer"
  },
  customer: {
    organisation_owner: "Organisation owner", procurement_manager: "Procurement manager", project_manager: "Project manager",
    quantity_surveyor: "Quantity surveyor", finance_officer: "Finance officer", site_supervisor: "Site supervisor",
    requester: "Requester", approver: "Approver", viewer: "Viewer"
  }
} as const;

export const ORGANISATION_PERMISSIONS = {
  supplier: ["supplier.profile.view","supplier.profile.edit","supplier.staff.view","supplier.staff.invite","supplier.staff.manage","branches.manage","warehouses.manage","products.view","products.create","products.edit","products.publish","inventory.view","inventory.adjust","quotations.view","quotations.submit","orders.view","orders.accept","orders.reject","deliveries.view","deliveries.manage","finance.view","settlements.view","settlement_details.manage","reports.view"],
  customer: ["organisation.view","organisation.manage","projects.create","projects.edit","purchase_requests.create","purchase_requests.approve","quotations.view","quotations.accept","orders.create","orders.approve","payments.initiate","invoices.view","reports.view","staff.invite","staff.manage"]
} as const;

export function organisationRoleOptions(scope: OrganisationScope) {
  return Object.entries(ORGANISATION_ROLE_LABELS[scope]).map(([key,label])=>({key,label}));
}
