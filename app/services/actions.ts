"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const text = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();

export async function createServiceRequest(
  providerId: string,
  categoryId: string,
  formData: FormData,
) {
  await requireUser();
  const supabase = await createClient();
  const budgetText = text(formData, "budget");
  const { data, error } = await supabase.rpc("create_service_request", {
    target_provider: providerId,
    target_category: categoryId,
    target_title: text(formData, "title"),
    target_description: text(formData, "description"),
    target_region: text(formData, "region"),
    target_city: text(formData, "city"),
    target_address: text(formData, "address"),
    target_preferred_at: text(formData, "preferredAt") || null,
    target_budget: budgetText ? Number(budgetText) : null,
  });
  if (error)
    redirect(
      `/services/providers/${providerId}?error=${encodeURIComponent(error.message)}`,
    );
  redirect(`/dashboard/services?created=${data}`);
}

export async function createProviderProfile(formData: FormData) {
  await requireUser();
  const supabase = await createClient();
  const displayName = text(formData, "displayName");
  const bio = text(formData, "bio");
  const region = text(formData, "region");
  const categoryIds = formData
    .getAll("categoryIds")
    .map(String)
    .filter((value) => /^[0-9a-f-]{36}$/i.test(value));
  if (
    displayName.length < 2 ||
    bio.length < 20 ||
    region.length < 2 ||
    !categoryIds.length
  )
    redirect(
      "/provider?error=Complete+your+profile+and+choose+at+least+one+service",
    );
  const { error } = await supabase.rpc("register_service_provider", {
    target_display_name: displayName,
    target_bio: bio,
    target_phone: text(formData, "phone"),
    target_region: region,
    target_city: text(formData, "city"),
    target_categories: categoryIds,
  });
  if (error) redirect(`/provider?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/provider");
  redirect("/provider?submitted=1");
}

export async function progressServiceRequest(
  requestId: string,
  formData: FormData,
) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("provider_progress_service_request", {
    target_request: requestId,
    target_status: text(formData, "status"),
    target_message: text(formData, "message") || null,
    target_proposed_at: text(formData, "proposedAt") || null,
  });
  if (error)
    redirect(`/provider/requests?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/provider");
  revalidatePath("/provider/requests");
}

export async function customerProgressServiceRequest(
  requestId: string,
  formData: FormData,
) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("customer_progress_service_request", {
    target_request: requestId,
    target_action: text(formData, "action"),
    target_reason: text(formData, "reason") || null,
  });
  if (error)
    redirect(`/dashboard/services?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard/services");
}

export async function updateProviderAvailability(
  providerId: string,
  formData: FormData,
) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_provider_availability", {
    target_provider: providerId,
    target_status: text(formData, "status"),
    target_from: text(formData, "availableFrom") || null,
    target_until: text(formData, "availableUntil") || null,
  });
  if (error)
    redirect(
      `/provider/availability?error=${encodeURIComponent(error.message)}`,
    );
  revalidatePath("/provider");
  revalidatePath("/provider/availability");
}
