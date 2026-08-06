"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupplierMembership } from "@/lib/supplier/data";
import { markStepCompleted, getNextIncompleteStep } from "@/lib/supplier/progress";
import type { OnboardingStep } from "@/lib/supplier/constants";
import {
  branchSchema,
  businessInformationSchema,
  contactInformationSchema,
  deliveryCoverageSchema,
  documentUploadSchema,
  registrationComplianceSchema,
  settlementSchema
} from "@/lib/supplier/validation";

type ActionResult = { success: true } | { success: false; error: string };

async function getEditableMembership(organisationId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { supabase, membership: null, error: "You must be signed in." } as const;

  const membership = await getSupplierMembership(supabase, user.id);
  if (!membership || membership.organisationId !== organisationId) {
    return { supabase, membership: null, error: "You do not have access to this application." } as const;
  }
  const {data:canEdit}=await supabase.rpc("has_permission",{target_permission:"supplier.profile.edit",target_organisation:organisationId});
  if(!canEdit)return{supabase,membership:null,error:"Your supplier role cannot edit this application."} as const;
  if (membership.organisation.verification_status !== "draft" && membership.organisation.verification_status !== "information_required") {
    return { supabase, membership: null, error: "This application can no longer be edited." } as const;
  }
  return { supabase, membership, error: null } as const;
}

async function completeStep(organisationId: string, step: OnboardingStep, completedSteps: string[]) {
  const supabase = await createClient();
  const updated = markStepCompleted(completedSteps, step);
  await supabase
    .from("supplier_profiles")
    .update({ onboarding_completed_steps: updated, onboarding_step: getNextIncompleteStep(updated) })
    .eq("organisation_id", organisationId);
  revalidatePath("/supplier/onboarding");
}

export async function saveBusinessInformation(organisationId: string, input: unknown, completedSteps: string[]): Promise<ActionResult> {
  const parsed = businessInformationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" };

  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to save" };

  const { error: orgError } = await supabase.from("organisations").update({ name: parsed.data.registeredName }).eq("id", organisationId);
  if (orgError) return { success: false, error: orgError.message };

  const { error: upsertError } = await supabase.from("supplier_profiles").upsert({
    organisation_id: organisationId,
    trading_name: parsed.data.tradingName,
    business_type: parsed.data.businessType,
    business_description: parsed.data.businessDescription,
    year_established: parsed.data.yearEstablished,
    website: parsed.data.website,
    primary_categories: parsed.data.primaryCategories,
    branch_count: parsed.data.numberOfBranches,
    employee_count: parsed.data.numberOfEmployees
  });
  if (upsertError) return { success: false, error: upsertError.message };

  await completeStep(organisationId, "business_information", completedSteps);
  return { success: true };
}

export async function saveContactInformation(organisationId: string, input: unknown, completedSteps: string[]): Promise<ActionResult> {
  const parsed = contactInformationSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" };

  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to save" };

  const { error: upsertError } = await supabase.from("supplier_profiles").upsert({
    organisation_id: organisationId,
    primary_contact_name: parsed.data.primaryContactName,
    primary_phone: parsed.data.primaryPhone,
    alternative_phone: parsed.data.alternativePhone,
    business_email: parsed.data.businessEmail,
    whatsapp_number: parsed.data.whatsappNumber,
    physical_address: parsed.data.physicalAddress,
    region: parsed.data.region,
    city: parsed.data.city,
    area: parsed.data.area,
    ghanapost_gps: parsed.data.ghanaPostGps
  });
  if (upsertError) return { success: false, error: upsertError.message };

  await completeStep(organisationId, "contact_information", completedSteps);
  return { success: true };
}

export async function saveRegistrationCompliance(organisationId: string, input: unknown, completedSteps: string[]): Promise<ActionResult> {
  const parsed = registrationComplianceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" };

  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to save" };

  const { error: orgError } = await supabase
    .from("organisations")
    .update({ registration_number: parsed.data.registrationNumber, tax_id: parsed.data.tin })
    .eq("id", organisationId);
  if (orgError) return { success: false, error: orgError.message };

  const { error: upsertError } = await supabase.from("supplier_profiles").upsert({
    organisation_id: organisationId,
    vat_registered: parsed.data.vatRegistered,
    vat_number: parsed.data.vatNumber,
    gsa_registration_number: parsed.data.gsaRegistrationNumber,
    distributor_authorisation_number: parsed.data.distributorAuthorisationNumber,
    registration_document_expiry: parsed.data.registrationDocumentExpiry || null,
    vat_certificate_expiry: parsed.data.vatCertificateExpiry || null,
    distributor_authorisation_expiry: parsed.data.distributorAuthorisationExpiry || null
  });
  if (upsertError) return { success: false, error: upsertError.message };

  await completeStep(organisationId, "registration_compliance", completedSteps);
  return { success: true };
}

export async function saveBranch(organisationId: string, input: unknown): Promise<ActionResult> {
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the branch details" };

  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to save" };

  const record = {
    organisation_id: organisationId,
    name: parsed.data.name,
    branch_type: parsed.data.branchType,
    phone: parsed.data.phone,
    address: parsed.data.address,
    region: parsed.data.region,
    city: parsed.data.city,
    area: parsed.data.area,
    ghanapost_gps: parsed.data.ghanaPostGps,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    operating_hours: parsed.data.operatingHours,
    contact_person: parsed.data.contactPerson,
    is_main_branch: parsed.data.isMainBranch,
    supports_pickup: parsed.data.supportsPickup
  };

  const { error: dbError } = parsed.data.id
    ? await supabase.from("supplier_branches").update(record).eq("id", parsed.data.id)
    : await supabase.from("supplier_branches").insert(record);

  if (dbError) {
    if (dbError.code === "23505") return { success: false, error: "This organisation already has a main branch. Unset it before assigning a new one." };
    return { success: false, error: dbError.message };
  }

  revalidatePath("/supplier/onboarding");
  return { success: true };
}

export async function deleteBranch(organisationId: string, branchId: string): Promise<ActionResult> {
  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to delete" };

  const { error: dbError } = await supabase.from("supplier_branches").delete().eq("id", branchId).eq("organisation_id", organisationId);
  if (dbError) return { success: false, error: dbError.message };

  revalidatePath("/supplier/onboarding");
  return { success: true };
}

export async function completeBranchesStep(organisationId: string, completedSteps: string[]): Promise<ActionResult> {
  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to save" };

  const { count } = await supabase
    .from("supplier_branches")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", organisationId);
  if (!count) return { success: false, error: "Add at least one branch or warehouse before continuing" };

  await completeStep(organisationId, "branches", completedSteps);
  return { success: true };
}

export async function saveDeliveryCoverage(organisationId: string, input: unknown, completedSteps: string[]): Promise<ActionResult> {
  const parsed = deliveryCoverageSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" };

  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to save" };

  const { error: upsertError } = await supabase.from("supplier_delivery_coverage").upsert({
    organisation_id: organisationId,
    regions_served: parsed.data.regionsServed,
    cities_served: parsed.data.citiesServed,
    max_delivery_radius_km: parsed.data.maxDeliveryRadiusKm ?? null,
    minimum_order_value: parsed.data.minimumOrderValue ?? null,
    same_day_delivery: parsed.data.sameDayDelivery,
    standard_lead_time_days: parsed.data.standardLeadTimeDays,
    customer_pickup_available: parsed.data.customerPickupAvailable,
    delivery_handled_by: parsed.data.deliveryHandledBy
  });
  if (upsertError) return { success: false, error: upsertError.message };

  await completeStep(organisationId, "delivery_coverage", completedSteps);
  return { success: true };
}

export async function saveSettlementDetails(organisationId: string, input: unknown, completedSteps: string[]): Promise<ActionResult> {
  const parsed = settlementSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again" };

  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to save" };

  if (membership.memberRole !== "owner" && membership.memberRole !== "finance") {
    return { success: false, error: "Only the account owner or finance staff can set settlement details" };
  }

  const { error: upsertError } = await supabase.from("supplier_settlement_details").upsert({
    organisation_id: organisationId,
    settlement_method: parsed.data.settlementMethod,
    bank_name: parsed.data.bankName || null,
    account_name: parsed.data.accountName || null,
    account_number: parsed.data.accountNumber || null,
    momo_network: parsed.data.momoNetwork || null,
    momo_number: parsed.data.momoNumber || null,
    momo_account_name: parsed.data.momoAccountName || null
  });
  if (upsertError) return { success: false, error: upsertError.message };

  await completeStep(organisationId, "settlement", completedSteps);
  return { success: true };
}

export async function recordDocumentUpload(organisationId: string, input: unknown): Promise<ActionResult> {
  const parsed = documentUploadSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Upload failed" };

  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to save" };

  const { error: insertError } = await supabase.from("supplier_documents").insert({
    organisation_id: organisationId,
    document_type: parsed.data.documentType,
    storage_path: parsed.data.storagePath,
    file_name: parsed.data.fileName,
    mime_type: parsed.data.mimeType,
    file_size: parsed.data.fileSize,
    uploaded_by: (await supabase.auth.getUser()).data.user?.id
  });
  if (insertError) return { success: false, error: insertError.message };

  revalidatePath("/supplier/onboarding");
  return { success: true };
}

export async function deleteDocument(organisationId: string, documentId: string, storagePath: string): Promise<ActionResult> {
  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to delete" };

  await supabase.storage.from("supplier-documents").remove([storagePath]);
  const { error: dbError } = await supabase.from("supplier_documents").delete().eq("id", documentId).eq("organisation_id", organisationId);
  if (dbError) return { success: false, error: dbError.message };

  revalidatePath("/supplier/onboarding");
  return { success: true };
}

export async function getDocumentSignedUrl(storagePath: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("supplier-documents").createSignedUrl(storagePath, 60);
  if (error || !data) return { error: error?.message ?? "Unable to generate a link" };
  return { url: data.signedUrl };
}

export async function completeDocumentsStep(organisationId: string, completedSteps: string[]): Promise<ActionResult> {
  const { supabase, membership, error } = await getEditableMembership(organisationId);
  if (!membership) return { success: false, error: error ?? "Unable to save" };

  const { data: documents } = await supabase.from("supplier_documents").select("document_type").eq("organisation_id", organisationId);
  const uploadedTypes = new Set((documents ?? []).map((d) => d.document_type));
  const missing = ["business_registration_certificate", "identification", "tin_document"].filter((type) => !uploadedTypes.has(type));
  if (missing.length > 0) {
    return { success: false, error: "Upload the business registration certificate, ID and TIN document before continuing" };
  }

  await completeStep(organisationId, "documents", completedSteps);
  return { success: true };
}

export async function submitSupplierApplication(organisationId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const { error } = await supabase.rpc("submit_supplier_application", { target_org: organisationId });
  if (error) return { success: false, error: error.message };

  revalidatePath("/supplier/onboarding");
  revalidatePath("/supplier");
  return { success: true };
}
