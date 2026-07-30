"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { VERIFICATION_STATUSES, VERIFICATION_STATUS_LABELS } from "@/lib/supplier/constants";

export function SupplierFilterBar({ currentStatus, currentQuery }: { currentStatus: string; currentQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(currentQuery);

  function updateParams(next: { status?: string; q?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.status !== undefined) {
      if (next.status) params.set("status", next.status);
      else params.delete("status");
    }
    if (next.q !== undefined) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    router.push(`/admin/suppliers?${params.toString()}`);
  }

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateParams({ status: "" })}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${currentStatus === "" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          All
        </button>
        {VERIFICATION_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => updateParams({ status })}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${currentStatus === status ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {VERIFICATION_STATUS_LABELS[status]}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParams({ q: query });
        }}
        className="flex gap-2"
      >
        <input
          className="input"
          placeholder="Search by supplier name, contact or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-secondary shrink-0">Search</button>
      </form>
    </div>
  );
}
