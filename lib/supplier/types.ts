import type { BusinessType, BranchType, DeliveryHandler, DocumentType, SettlementMethod, VerificationLevel, VerificationStatus } from "@/lib/supplier/constants";

export interface SupplierOrganisation {
  id: string;
  name: string;
  organisation_type: string;
  registration_number: string | null;
  tax_id: string | null;
  verification_status: VerificationStatus;
  verification_levels: VerificationLevel[];
  decision_reason: string | null;
  suspended_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  suspended_at: string | null;
  reviewer_id: string | null;
}

export interface SupplierProfileRow {
  organisation_id: string;
  trading_name: string | null;
  business_type: BusinessType | null;
  business_description: string | null;
  year_established: number | null;
  website: string | null;
  primary_categories: string[];
  branch_count: number | null;
  employee_count: number | null;
  primary_contact_name: string | null;
  primary_phone: string | null;
  alternative_phone: string | null;
  business_email: string | null;
  whatsapp_number: string | null;
  physical_address: string | null;
  region: string | null;
  city: string | null;
  area: string | null;
  ghanapost_gps: string | null;
  vat_registered: boolean;
  vat_number: string | null;
  gsa_registration_number: string | null;
  distributor_authorisation_number: string | null;
  registration_document_expiry: string | null;
  vat_certificate_expiry: string | null;
  distributor_authorisation_expiry: string | null;
  onboarding_step: string;
  onboarding_completed_steps: string[];
}

export interface SupplierBranchRow {
  id: string;
  organisation_id: string;
  name: string;
  branch_type: BranchType;
  phone: string | null;
  address: string;
  region: string;
  city: string;
  area: string | null;
  ghanapost_gps: string | null;
  latitude: number | null;
  longitude: number | null;
  operating_hours: string | null;
  contact_person: string | null;
  is_main_branch: boolean;
  supports_pickup: boolean;
}

export interface SupplierDeliveryCoverageRow {
  organisation_id: string;
  regions_served: string[];
  cities_served: string[];
  max_delivery_radius_km: number | null;
  minimum_order_value: number | null;
  same_day_delivery: boolean;
  standard_lead_time_days: number | null;
  customer_pickup_available: boolean;
  delivery_handled_by: DeliveryHandler;
}

export interface SupplierSettlementRow {
  organisation_id: string;
  settlement_method: SettlementMethod;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  momo_network: string | null;
  momo_number: string | null;
  momo_account_name: string | null;
}

export interface SupplierDocumentRow {
  id: string;
  organisation_id: string;
  document_type: DocumentType;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface SupplierReviewEventRow {
  id: number;
  organisation_id: string;
  actor_id: string | null;
  event_type: string;
  from_status: VerificationStatus | null;
  to_status: VerificationStatus | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SupplierReviewNoteRow {
  id: number;
  organisation_id: string;
  author_id: string;
  note: string;
  created_at: string;
}
