"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SupportActionState = { error?: string; message?: string; ticketId?: string; ticketNumber?: string };
const optionalUuid = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "");
  return /^[0-9a-f-]{36}$/i.test(text) ? text : null;
};

export async function createSupportTicket(_: SupportActionState, formData: FormData): Promise<SupportActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_support_ticket", {
    target_category: String(formData.get("category") ?? ""), target_subject: String(formData.get("subject") ?? ""),
    target_description: String(formData.get("description") ?? ""), target_priority: String(formData.get("priority") ?? "normal"),
    target_organisation: optionalUuid(formData.get("organisationId")), target_order: optionalUuid(formData.get("orderId")),
    target_delivery: optionalUuid(formData.get("deliveryId")), target_quote: optionalUuid(formData.get("quoteId")),
    target_service_request: optionalUuid(formData.get("serviceRequestId")), target_source_route: String(formData.get("sourceRoute") ?? "").slice(0, 500),
  } as never);
  if (error) return { error: error.message };
  const result = (data as unknown as { ticket_id: string; ticket_number: string }[] | null)?.[0];
  if (!result) return { error: "We couldn't create this support request. Please try again." };
  revalidatePath("/support"); revalidatePath("/admin/support");
  return { message: `Support request ${result.ticket_number} created successfully.`, ticketId: result.ticket_id, ticketNumber: result.ticket_number };
}

export async function replySupportTicket(_: SupportActionState, formData: FormData): Promise<SupportActionState> {
  const ticketId = optionalUuid(formData.get("ticketId"));
  if (!ticketId) return { error: "Support ticket unavailable." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_support_ticket", { target_ticket: ticketId, target_body: String(formData.get("body") ?? ""), target_internal: formData.get("internalNote") === "on" } as never);
  if (error) return { error: error.message };
  revalidatePath(`/support/${ticketId}`); revalidatePath(`/admin/support/${ticketId}`); revalidatePath("/admin/support");
  return { message: "Reply sent." };
}

export async function updateSupportTicket(formData: FormData) {
  const ticketId = optionalUuid(formData.get("ticketId"));
  if (!ticketId) throw new Error("Support ticket unavailable");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_support_ticket", {
    target_ticket: ticketId, target_status: String(formData.get("status") ?? "open"),
    target_priority: String(formData.get("priority") ?? "normal"), target_category: String(formData.get("category") ?? "technical_problem"),
    target_assignee: optionalUuid(formData.get("assignedTo")),
  } as never);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/support/${ticketId}`); revalidatePath("/admin/support");
}
