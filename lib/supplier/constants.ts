export const ONBOARDING_STEPS = [
  "business_information",
  "contact_information",
  "registration_compliance",
  "branches",
  "delivery_coverage",
  "settlement",
  "documents",
  "review"
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_STEP_LABELS: Record<OnboardingStep, string> = {
  business_information: "Business information",
  contact_information: "Contact information",
  registration_compliance: "Business registration",
  branches: "Branch or warehouse",
  delivery_coverage: "Delivery coverage",
  settlement: "Payment and settlement",
  documents: "Document upload",
  review: "Review and submission"
};

export const BUSINESS_TYPES = [
  "sole_proprietorship",
  "partnership",
  "limited_liability_company",
  "manufacturer",
  "distributor",
  "wholesaler",
  "retailer",
  "hardware_shop",
  "other"
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  sole_proprietorship: "Sole proprietorship",
  partnership: "Partnership",
  limited_liability_company: "Limited liability company",
  manufacturer: "Manufacturer",
  distributor: "Distributor",
  wholesaler: "Wholesaler",
  retailer: "Retailer",
  hardware_shop: "Hardware shop",
  other: "Other"
};

export const BRANCH_TYPES = ["head_office", "branch", "warehouse", "showroom"] as const;
export type BranchType = (typeof BRANCH_TYPES)[number];

export const BRANCH_TYPE_LABELS: Record<BranchType, string> = {
  head_office: "Head office",
  branch: "Branch",
  warehouse: "Warehouse",
  showroom: "Showroom"
};

export const DOCUMENT_TYPES = [
  "business_registration_certificate",
  "identification",
  "tin_document",
  "vat_certificate",
  "proof_of_address",
  "distributor_authorisation",
  "warehouse_photo",
  "other"
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  business_registration_certificate: "Business registration certificate",
  identification: "Ghana Card or representative ID",
  tin_document: "TIN document",
  vat_certificate: "VAT certificate",
  proof_of_address: "Proof of business address",
  distributor_authorisation: "Manufacturer / distributor authorisation",
  warehouse_photo: "Warehouse photograph",
  other: "Other supporting document"
};

export const REQUIRED_DOCUMENT_TYPES: DocumentType[] = [
  "business_registration_certificate",
  "identification",
  "tin_document"
];

export const ALLOWED_DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const VERIFICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "information_required",
  "approved",
  "rejected",
  "suspended"
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  information_required: "Information required",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended"
};

export const VERIFICATION_LEVELS = [
  "identity_verified",
  "business_verified",
  "warehouse_verified",
  "authorised_distributor",
  "premium_supplier"
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const VERIFICATION_LEVEL_LABELS: Record<VerificationLevel, string> = {
  identity_verified: "Identity verified",
  business_verified: "Business verified",
  warehouse_verified: "Warehouse verified",
  authorised_distributor: "Authorised distributor",
  premium_supplier: "Premium supplier"
};

export const GHANA_REGIONS = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North"
] as const;

export const PRODUCT_CATEGORIES = [
  "Cement & Blocks",
  "Steel & Reinforcement",
  "Roofing",
  "Plumbing",
  "Electrical",
  "Tiles & Finishing",
  "Paint",
  "Tools & Equipment"
] as const;

export const DELIVERY_HANDLERS = ["internal", "platform_logistics"] as const;
export type DeliveryHandler = (typeof DELIVERY_HANDLERS)[number];

export const DELIVERY_HANDLER_LABELS: Record<DeliveryHandler, string> = {
  internal: "We deliver ourselves",
  platform_logistics: "Platform logistics"
};

export const SETTLEMENT_METHODS = ["bank", "mobile_money"] as const;
export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];
