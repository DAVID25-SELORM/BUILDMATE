"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_DOCUMENT_MIME_TYPES, DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, MAX_DOCUMENT_SIZE_BYTES, REQUIRED_DOCUMENT_TYPES, type DocumentType } from "@/lib/supplier/constants";
import { completeDocumentsStep, deleteDocument, getDocumentSignedUrl, recordDocumentUpload } from "@/app/supplier/onboarding/actions";
import type { SupplierDocumentRow } from "@/lib/supplier/types";

export function DocumentsStep({
  organisationId,
  initialDocuments,
  completedSteps,
  onBack,
  onSaved
}: {
  organisationId: string;
  initialDocuments: SupplierDocumentRow[];
  completedSteps: string[];
  onBack: () => void;
  onSaved: (advance: boolean) => void;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentType, setDocumentType] = useState<DocumentType>("business_registration_certificate");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [continueLoading, setContinueLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setUploadError(null);

    if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
      setUploadError("Only PDF, JPG and PNG files are allowed");
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setUploadError("File must be 10MB or smaller");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const storagePath = `${organisationId}/${documentType}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("supplier-documents").upload(storagePath, file, { contentType: file.type });

    if (uploadErr) {
      setUploading(false);
      setUploadError(uploadErr.message);
      return;
    }

    const result = await recordDocumentUpload(organisationId, {
      documentType,
      storagePath,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size
    });
    setUploading(false);

    if (!result.success) {
      setUploadError(result.error);
      return;
    }

    setDocuments((prev) => [
      { id: crypto.randomUUID(), organisation_id: organisationId, document_type: documentType, storage_path: storagePath, file_name: file.name, mime_type: file.type, file_size: file.size, uploaded_by: "", created_at: new Date().toISOString() },
      ...prev
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleView(doc: SupplierDocumentRow) {
    const result = await getDocumentSignedUrl(doc.storage_path);
    if ("url" in result) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    } else {
      setUploadError(result.error);
    }
  }

  async function handleDelete(doc: SupplierDocumentRow) {
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    await deleteDocument(organisationId, doc.id, doc.storage_path);
  }

  async function handleContinue(advance: boolean) {
    setContinueError(null);
    if (!advance) {
      onSaved(false);
      return;
    }
    setContinueLoading(true);
    const result = await completeDocumentsStep(organisationId, completedSteps);
    setContinueLoading(false);
    if (!result.success) {
      setContinueError(result.error);
      return;
    }
    onSaved(true);
  }

  const uploadedTypes = new Set(documents.map((d) => d.document_type));

  return (
    <div className="card space-y-5 p-6">
      <div>
        <h2 className="text-xl font-bold">Document upload</h2>
        <p className="mt-1 text-sm text-slate-600">
          PDF, JPG or PNG, up to 10MB each. Documents are stored privately and only visible to your team and BuildMate reviewers.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {REQUIRED_DOCUMENT_TYPES.map((type) => (
          <p key={type} className="text-sm">
            <span className={uploadedTypes.has(type) ? "text-green-700" : "text-slate-500"}>{uploadedTypes.has(type) ? "✓" : "○"}</span>{" "}
            {DOCUMENT_TYPE_LABELS[type]} {!uploadedTypes.has(type) && <span className="text-red-600">(required)</span>}
          </p>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-4">
        <div>
          <label className="label" htmlFor="documentType">Document type</label>
          <select id="documentType" className="input" value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType)}>
            {DOCUMENT_TYPES.map((type) => <option key={type} value={type}>{DOCUMENT_TYPE_LABELS[type]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="documentFile">File</label>
          <input
            id="documentFile"
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </div>
        {uploading && <span className="text-sm text-slate-500">Uploading...</span>}
      </div>
      {uploadError && <p className="text-sm font-medium text-red-600" role="alert">{uploadError}</p>}

      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm">
            <div>
              <p className="font-semibold">{doc.file_name}</p>
              <p className="text-slate-500">{DOCUMENT_TYPE_LABELS[doc.document_type]}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary py-1.5 text-xs" onClick={() => handleView(doc)}>View</button>
              <button type="button" className="btn-secondary py-1.5 text-xs" onClick={() => handleDelete(doc)}>Delete</button>
            </div>
          </div>
        ))}
        {documents.length === 0 && <p className="text-sm text-slate-500">No documents uploaded yet.</p>}
      </div>

      {continueError && <p className="text-sm font-medium text-red-600" role="alert">{continueError}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <button type="button" className="btn-secondary" onClick={onBack} disabled={continueLoading}>Back</button>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary" onClick={() => handleContinue(false)} disabled={continueLoading}>Save as draft</button>
          <button type="button" className="btn-primary" onClick={() => handleContinue(true)} disabled={continueLoading}>{continueLoading ? "Saving..." : "Save & continue"}</button>
        </div>
      </div>
    </div>
  );
}
