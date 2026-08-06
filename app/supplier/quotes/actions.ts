"use server";
import { revalidatePath } from "next/cache";
import { requireSupplierPermission } from "@/lib/organisations/access";
import { supplierQuoteSchema } from "@/lib/rfq/validation";

export async function submitSupplierQuote(formData: FormData) {
  const {supabase,membership}=await requireSupplierPermission("quotations.submit");
  if (!membership || membership.organisation.verification_status !== "approved") return { error: "Supplier approval is required" };
  const parsed = supplierQuoteSchema.safeParse({ quoteRequestId: formData.get("quoteRequestId"), subtotal: formData.get("subtotal"), deliveryFee: formData.get("deliveryFee"), validUntil: formData.get("validUntil") ?? "", deliveryDays: formData.get("deliveryDays"), notes: formData.get("notes") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid quotation" };
  const { data: request } = await supabase.from("quote_requests").select("id,status").eq("id", parsed.data.quoteRequestId).eq("status", "open").maybeSingle();
  if (!request) return { error: "This RFQ is no longer open" };
  const { error } = await supabase.from("supplier_quotes").upsert({ quote_request_id: parsed.data.quoteRequestId, supplier_id: membership.organisationId, subtotal: parsed.data.subtotal, delivery_fee: parsed.data.deliveryFee, valid_until: parsed.data.validUntil, delivery_days: parsed.data.deliveryDays, notes: parsed.data.notes || null, status: "responded" }, { onConflict: "quote_request_id,supplier_id" });
  if (error) return { error: error.message };
  revalidatePath("/supplier/quotes"); revalidatePath(`/dashboard/quotes/${parsed.data.quoteRequestId}`);
  return { success: true };
}
