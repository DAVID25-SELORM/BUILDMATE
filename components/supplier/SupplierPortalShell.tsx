"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { OrganisationSwitcher } from "@/components/organisations/OrganisationSwitcher";
import { SupplierSidebar } from "./SupplierSidebar";

type OrganisationChoice = { id: string; name: string };
type SupplierPortalShellProps = {
  children: React.ReactNode;
  organisationId?: string;
  organisationName: string;
  organisationChoices?: OrganisationChoice[];
  previewBase?: string;
};

export function SupplierPortalShell({
  children,
  organisationId,
  organisationName,
  organisationChoices = [],
  previewBase,
}: SupplierPortalShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-[#f6f8f8]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 lg:hidden"
              aria-label="Open supplier navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              href={previewBase ? "/admin" : "/"}
              aria-label={
                previewBase
                  ? "Return to BuildMate admin"
                  : "BuildMate Ghana home"
              }
              className="shrink-0"
            >
              <div className="text-base font-extrabold tracking-tight text-emerald-900">
                BuildMate
              </div>
              <div className="text-[10px] font-semibold tracking-[0.25em] text-slate-400">
                GHANA
              </div>
            </Link>
          </div>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="hidden text-right md:block">
              <p className="text-xs text-slate-400">
                {previewBase
                  ? "Generic preview organisation"
                  : "Supplier organisation"}
              </p>
              {previewBase ? (
                <p className="font-semibold text-slate-700">
                  {organisationName}
                </p>
              ) : (
                organisationId && (
                  <OrganisationSwitcher
                    scope="supplier"
                    currentId={organisationId}
                    choices={organisationChoices}
                  />
                )
              )}
            </div>
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 sm:inline-flex">
              Supplier Portal
            </span>
            {previewBase ? (
              <Link className="btn-secondary min-h-10 px-3 py-2" href="/admin">
                Return to Admin
              </Link>
            ) : (
              <SignOutButton className="min-h-10 px-3 py-2" />
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px]">
        <div className="sticky top-16 hidden h-[calc(100vh-4rem)] lg:block">
          <SupplierSidebar previewBase={previewBase} />
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[290px] max-w-[88vw] bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <div className="font-extrabold text-emerald-900">BuildMate</div>
                <div className="text-[10px] tracking-[0.22em] text-slate-400">
                  SUPPLIER
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100"
                aria-label="Close supplier navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-slate-100 px-4 py-3 md:hidden">
              <p className="mb-1 text-xs text-slate-400">{organisationName}</p>
              {!previewBase && organisationId && (
                <OrganisationSwitcher
                  scope="supplier"
                  currentId={organisationId}
                  choices={organisationChoices}
                />
              )}
            </div>
            <SupplierSidebar
              previewBase={previewBase}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
