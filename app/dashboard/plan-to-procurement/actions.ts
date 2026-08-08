"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { resolveActiveOrganisation } from "@/lib/organisations/active";
import { createClient } from "@/lib/supabase/server";

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
  const title = String(formData.get("title") ?? "").trim();
  const projectType = String(formData.get("projectType") ?? "");
  const stage = String(formData.get("stage") ?? "");
  const sourceType = String(formData.get("sourceType") ?? "");
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
  const { error: rowError } = await supabase.from("project_procurement_uploads").insert({ id, owner_id: user.id, organisation_id: active?.id ?? null, title, project_type: projectType, current_stage: stage, source_type: sourceType, storage_path: storagePath, original_filename: file.name, mime_type: file.type, file_size: file.size, status: "uploaded" });
  if (rowError) return { message: rowError.message };
  const { error: uploadError } = await supabase.storage.from("project-private-media").upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) { await supabase.from("project_procurement_uploads").delete().eq("id", id); return { message: uploadError.message }; }
  await supabase.from("project_procurement_uploads").update({ status: "review_pending" }).eq("id", id);
  revalidatePath("/dashboard/plan-to-procurement");
  return { ok: true, message: "Upload secured. BuildMate will use it for assisted procurement review; no automated quantities are presented as professional certification." };
}
