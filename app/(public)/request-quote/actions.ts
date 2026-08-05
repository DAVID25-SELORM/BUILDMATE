"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseMaterialLines, rfqSchema } from "@/lib/rfq/validation";

export async function createQuoteRequest(formData: FormData) {
  const { user } = await requireUser();
  const parsed = rfqSchema.safeParse({ title: formData.get("title"), deliveryLocation: formData.get("deliveryLocation"), requiredDate: formData.get("requiredDate") ?? "", materialList: formData.get("materialList"), notes: formData.get("notes") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
  const supabase = await createClient();
  const { data: request, error } = await supabase.from("quote_requests").insert({ requester_id: user.id, title: parsed.data.title, delivery_location: parsed.data.deliveryLocation, required_date: parsed.data.requiredDate, notes: parsed.data.notes || null, status: "open" }).select("id").single();
  if (error || !request) return { error: error?.message ?? "Unable to create request" };
  const items = parseMaterialLines(parsed.data.materialList).map((item) => ({ ...item, quote_request_id: request.id }));
  const { error: itemError } = await supabase.from("quote_request_items").insert(items);
  if (itemError) { await supabase.from("quote_requests").delete().eq("id", request.id); return { error: itemError.message }; }
  redirect(`/dashboard/quotes/${request.id}`);
}
