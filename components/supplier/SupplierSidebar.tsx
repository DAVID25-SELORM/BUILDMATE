"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supplierNav } from "./supplier-nav";

type SupplierSidebarProps = { onNavigate?: () => void };

export function SupplierSidebar({ onNavigate }: SupplierSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-4 py-5">
        <nav aria-label="Supplier navigation" className="space-y-1">
          {supplierNav.map((item) => {
            const Icon = item.icon;
            const aliases = item.href === "/supplier/quotations" ? ["/supplier/quotes"] : [];
            const active = item.href === "/supplier"
              ? pathname === "/supplier"
              : [item.href, ...aliases].some((href) => pathname === href || pathname.startsWith(`${href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-700"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
