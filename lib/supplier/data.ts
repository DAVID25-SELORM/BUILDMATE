import type { SupabaseClient } from "@supabase/supabase-js";
import { maskAccountNumber } from "@/lib/supplier/mask";
import type {
  SupplierBranchRow,
  SupplierDeliveryCoverageRow,
  SupplierDocumentRow,
  SupplierOrganisation,
  SupplierProfileRow,
  SupplierReviewEventRow,
  SupplierReviewNoteRow
} from "@/lib/supplier/types";

export interface SupplierMembership {
  id?: string;
  organisationId: string;
  memberRole: string;
  organisation: SupplierOrganisation;
}

export async function getSupplierMembership(supabase: SupabaseClient, userId: string): Promise<SupplierMembership | null> {
  const { data: membership } = await supabase
    .from("organisation_members")
    .select("id, organisation_id, member_role, status")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: organisation } = await supabase
    .from("organisations")
    .select(
      "id, name, organisation_type, registration_number, tax_id, verification_status, verification_levels, decision_reason, suspended_reason, submitted_at, reviewed_at, approved_at, suspended_at, reviewer_id"
    )
    .eq("id", membership.organisation_id)
    .maybeSingle();

  if (!organisation) return null;

  return { id: membership.id, organisationId: membership.organisation_id, memberRole: membership.member_role, organisation };
}

export interface SupplierOnboardingBundle {
  profile: SupplierProfileRow | null;
  branches: SupplierBranchRow[];
  delivery: SupplierDeliveryCoverageRow | null;
  documents: SupplierDocumentRow[];
  hasSettlement: boolean;
  maskedSettlement: { accountNumberMasked: string; momoNumberMasked: string } | null;
}

export async function getSupplierOnboardingBundle(supabase: SupabaseClient, organisationId: string): Promise<SupplierOnboardingBundle> {
  const [{ data: profile }, { data: branches }, { data: delivery }, { data: documents }, { data: settlement }] = await Promise.all([
    supabase.from("supplier_profiles").select("*").eq("organisation_id", organisationId).maybeSingle(),
    supabase.from("supplier_branches").select("*").eq("organisation_id", organisationId).order("created_at", { ascending: true }),
    supabase.from("supplier_delivery_coverage").select("*").eq("organisation_id", organisationId).maybeSingle(),
    supabase.from("supplier_documents").select("*").eq("organisation_id", organisationId).order("created_at", { ascending: false }),
    supabase.from("supplier_settlement_details").select("account_number, momo_number").eq("organisation_id", organisationId).maybeSingle()
  ]);

  return {
    profile: (profile as SupplierProfileRow) ?? null,
    branches: (branches as SupplierBranchRow[]) ?? [],
    delivery: (delivery as SupplierDeliveryCoverageRow) ?? null,
    documents: (documents as SupplierDocumentRow[]) ?? [],
    hasSettlement: !!settlement,
    maskedSettlement: settlement
      ? {
          accountNumberMasked: maskAccountNumber(settlement.account_number),
          momoNumberMasked: maskAccountNumber(settlement.momo_number)
        }
      : null
  };
}

export async function getSupplierReviewEvents(supabase: SupabaseClient, organisationId: string): Promise<SupplierReviewEventRow[]> {
  const { data } = await supabase
    .from("supplier_review_events")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });
  return (data as SupplierReviewEventRow[]) ?? [];
}

export async function getSupplierReviewNotes(supabase: SupabaseClient, organisationId: string): Promise<SupplierReviewNoteRow[]> {
  const { data } = await supabase
    .from("supplier_review_notes")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });
  return (data as SupplierReviewNoteRow[]) ?? [];
}
