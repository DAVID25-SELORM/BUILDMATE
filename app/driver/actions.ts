"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isDeliveryOtp } from "@/lib/delivery/otp";
import { isFutureDateTime } from "@/lib/dates/future";

export async function updateDelivery(formData: FormData) {
  await requireRole(["driver"]);
  const { error } = await (
    await createClient()
  ).rpc("driver_update_delivery", {
    target_delivery: String(formData.get("delivery")),
    new_status: String(formData.get("status")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/driver");
}

export async function completeDelivery(_: unknown, formData: FormData) {
  await requireRole(["driver"]);
  const id = String(formData.get("delivery"));
  const requestKey = String(formData.get("requestKey") ?? "");
  const otp = String(formData.get("otp") ?? "");
  const outcome = String(formData.get("outcome"));
  const reason = String(formData.get("reason") ?? "").trim();
  const resolution = String(formData.get("resolution") ?? "") || null;
  const rescheduledFor = String(formData.get("rescheduledFor") ?? "") || null;
  const file = formData.get("proof");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestKey,
    )
  )
    return { error: "Invalid delivery request" };
  if (outcome !== "failed" && !isDeliveryOtp(otp))
    return { error: "Enter the six-digit OTP" };
  if (!["delivered", "partial", "failed"].includes(outcome))
    return { error: "Choose a delivery outcome" };
  if (outcome !== "delivered" && reason.length < 5)
    return { error: "Enter a detailed delivery exception reason" };
  if (
    outcome === "failed" &&
    !["reschedule", "return_to_origin"].includes(resolution ?? "")
  )
    return { error: "Choose reschedule or return to origin" };
  if (
    outcome === "failed" &&
    resolution === "reschedule" &&
    (!rescheduledFor || !isFutureDateTime(rescheduledFor))
  )
    return { error: "Choose a future reschedule date and time" };
  if (!(file instanceof File) || file.size === 0)
    return { error: "Proof photo is required" };
  if (file.size > 5_000_000 || !file.type.startsWith("image/"))
    return { error: "Upload an image under 5 MB" };
  const items = String(formData.get("itemIds") ?? "")
    .split(",")
    .filter(Boolean)
    .map((orderItemId) => ({
      order_item_id: orderItemId,
      delivered_quantity: Number(formData.get(`quantity_${orderItemId}`) ?? 0),
    }));
  if (
    items.some(
      (item) =>
        !Number.isFinite(item.delivered_quantity) ||
        item.delivered_quantity < 0,
    )
  )
    return { error: "Enter valid delivered quantities" };
  const s = await createClient();
  const path = `${id}/${requestKey}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error: uploadError } = await s.storage
    .from("delivery-proofs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError && uploadError.message !== "The resource already exists")
    return { error: uploadError.message };
  const { error } = await s.rpc("driver_record_delivery_attempt", {
    target_delivery: id,
    target_otp: otp,
    target_outcome: outcome,
    target_reason: reason,
    target_resolution: resolution,
    target_rescheduled_for: rescheduledFor,
    target_proofs: [path],
    target_items: items,
    target_request_key: requestKey,
  });
  if (error) {
    if (!uploadError) await s.storage.from("delivery-proofs").remove([path]);
    return { error: error.message };
  }
  revalidatePath("/driver");
  return {
    message:
      outcome === "delivered"
        ? "Delivery recorded"
        : "Delivery exception recorded",
  };
}
