"use client";

import { useState } from "react";
import { getAdminDocumentSignedUrl } from "@/app/admin/suppliers/actions";
import { DOCUMENT_TYPE_LABELS } from "@/lib/supplier/constants";
import type { SupplierDocumentRow } from "@/lib/supplier/types";

export function SupplierDocumentList({ documents }: { documents: SupplierDocumentRow[] }) {
  const [error, setError] = useState<string | null>(null);

  async function handleView(doc: SupplierDocumentRow) {
    setError(null);
    const result = await getAdminDocumentSignedUrl(doc.storage_path);
    if ("url" in result) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    } else {
      setError(result.error);
    }
  }

  if (documents.length === 0) return <p className="text-sm text-slate-500">No documents uploaded.</p>;

  return (
    <div className="space-y-2">
      {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm">
          <div>
            <p className="font-semibold">{doc.file_name}</p>
            <p className="text-slate-500">{DOCUMENT_TYPE_LABELS[doc.document_type]} • {new Date(doc.created_at).toLocaleDateString()}</p>
          </div>
          <button type="button" className="btn-secondary py-1.5 text-xs" onClick={() => handleView(doc)}>View</button>
        </div>
      ))}
    </div>
  );
}
