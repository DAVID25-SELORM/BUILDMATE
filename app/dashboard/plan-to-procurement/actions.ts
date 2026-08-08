"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { resolveActiveOrganisation } from "@/lib/organisations/active";
import { createClient } from "@/lib/supabase/server";
import { matchCatalogue, parseCsv, parseXlsx } from "@/lib/procurement/boq";
import { extractDocumentWithVision } from "@/lib/procurement/vision";

export type UploadState = { ok?: boolean; message: string };
const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const projectTypes = new Set(["residential", "commercial", "renovation", "other"]);
const stages = new Set(["foundation", "blockwork", "roofing", "plumbing", "electrical", "finishing", "painting"]);
const sourceTypes = new Set(["boq", "plan", "image"]);

export async function uploadProcurementSource(_: UploadState, formData: FormData): Promise<UploadState> {
  const { user } = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Choose a BOQ, PDF plan, spreadsheet or plan image." };
  if (file.size > 15 * 1024 * 1024) return { message: "The maximum file size is 15 MB." };
  if (!allowed.has(file.type)) return { message: "Use PDF, CSV, XLSX, JPG, PNG or WebP." };
  if ((file.type === "text/csv" || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") && file.size > 5 * 1024 * 1024) return { message: "Structured BOQ spreadsheets must be 5 MB or smaller." };
  const title = String(formData.get("title") ?? "").trim();
  const projectType = String(formData.get("projectType") ?? "");
  const stage = String(formData.get("stage") ?? "");
  const sourceType = String(formData.get("sourceType") ?? "");
  const consentToExternalProcessing = formData.get("allowAiProcessing") === "on";
  if (title.length < 3) return { message: "Enter a project title." };
  if (!projectTypes.has(projectType) || !stages.has(stage) || !sourceTypes.has(sourceType)) return { message: "Choose valid project, stage and document options." };

  const supabase = await createClient();
  const { active } = await resolveActiveOrganisation(supabase, user.id, "customer");
  if (active) {
    const { data: permitted } = await supabase.rpc("has_permission", { target_permission: "purchase_requests.create", target_organisation: active.id });
    if (!permitted) return { message: "Your organisation role cannot upload procurement documents." };
  }
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  const storagePath = `${user.id}/${id}/${safeName}`;
  const { error: rowError } = await supabase.from("project_procurement_uploads").insert({ id, owner_id: user.id, organisation_id: active?.id ?? null, title, project_type: projectType, current_stage: stage, source_type: sourceType, storage_path: storagePath, original_filename: file.name, mime_type: file.type, file_size: file.size, status: "uploaded", external_processing_consent_at: consentToExternalProcessing ? new Date().toISOString() : null });
  if (rowError) return { message: rowError.message };
  const { error: uploadError } = await supabase.storage.from("project-private-media").upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) { await supabase.from("project_procurement_uploads").delete().eq("id", id); return { message: uploadError.message }; }
  let extracted = 0;
  const spreadsheet = file.type === "text/csv" || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (spreadsheet || consentToExternalProcessing) {
    try {
      const vision = spreadsheet ? null : await extractDocumentWithVision(file);
      const rows = spreadsheet ? (file.type === "text/csv" ? parseCsv(await file.text()) : await parseXlsx(await file.arrayBuffer())) : vision!.items;
      const { data: products } = await supabase.from("products").select("id,name").eq("is_active", true).limit(1000);
      const records = rows.map(row => { const match = matchCatalogue(row.description, products ?? []); return { upload_id: id, source_sheet: row.sourceSheet, source_row: row.sourceRow, description: row.description, quantity: row.quantity, unit: row.unit, matched_product_id: match?.productId ?? null, match_confidence: match?.confidence ?? null }; });
      const { error: extractionError } = await supabase.from("procurement_upload_items").insert(records);
      if (extractionError) throw extractionError;
      extracted = records.length;
      await supabase.from("project_procurement_uploads").update({ extraction_method: spreadsheet ? "spreadsheet" : "vision", extraction_model: spreadsheet ? null : (process.env.OPENAI_VISION_MODEL || "gpt-5.6-luna"), extraction_warning: vision?.warning ?? null }).eq("id", id);
    } catch (cause) {
      await supabase.from("project_procurement_uploads").update({ status: "review_pending", extraction_warning: String(cause instanceof Error ? cause.message : "Extraction unavailable").slice(0,500) }).eq("id", id);
      revalidatePath("/dashboard/plan-to-procurement");
      return { ok: true, message: `File secured. ${cause instanceof Error ? cause.message : "Automated extraction was unavailable; assisted review is required."}` };
    }
  }
  await supabase.from("project_procurement_uploads").update({ status: "review_pending" }).eq("id", id);
  revalidatePath("/dashboard/plan-to-procurement");
  return { ok: true, message: extracted ? `${extracted} BOQ rows extracted for your review. Confirm every quantity before creating an RFQ.` : "Upload secured for assisted review; no automated quantities are presented as professional certification." };
}
