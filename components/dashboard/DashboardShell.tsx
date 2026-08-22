"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  Menu,
  Search,
} from "lucide-react";

type NavLink = { label: string; href: string };
type NavItem = string | (NavLink & { children?: readonly NavLink[] });

export function DashboardShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showPortalSwitcher = title === "Platform administration";
  const portalLinkClass =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-brand-300 hover:text-brand-700";
  const isCurrentHref = (href: string) => {
    const [hrefPath, query = ""] = href.split("?");
    if (pathname !== hrefPath) return false;
    const expected = new URLSearchParams(query);
    if (!query)
      return !["type", "status", "sort"].some((key) => searchParams.has(key));
    return [...expected].every(
      ([key, value]) => searchParams.get(key) === value,
    );
  };
  if (showPortalSwitcher) {
    const renderAdminNavigation = (mobile = false) => (
      <nav aria-label="Platform administration" className={mobile ? "max-h-[70vh] overflow-y-auto p-2" : "space-y-0.5 p-3"}>
        {nav.map((item, index) => {
          const label = typeof item === "string" ? item : item.label;
          const itemPath = typeof item === "string" ? "" : item.href.split("?")[0];
          const active = typeof item === "string" ? index === 0 : isCurrentHref(item.href) || (!item.href.includes("?") && index > 0 && pathname.startsWith(`${itemPath}/`));
          const className = `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`;
          return typeof item === "string" ? <span key={label} className={className}>{label}</span> : <Link key={item.href} href={item.href} prefetch aria-current={active ? "page" : undefined} className={className}><LayoutDashboard className="shrink-0" size={17} aria-hidden="true" /><span>{label}</span></Link>;
        })}
      </nav>
    );
    return (
      <div className="min-h-screen bg-slate-100">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
            <Link href="/" aria-label="BuildMate Ghana home" className="shrink-0"><BrandLogo /></Link>
            <div className="hidden h-8 w-px bg-slate-200 lg:block" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-slate-950">Platform administration</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">Marketplace operations and oversight</p>
            </div>
            <form action="/admin/customers" className="hidden w-64 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 lg:flex">
              <Search size={16} className="text-slate-400" aria-hidden="true" />
              <input name="q" aria-label="Search customers" placeholder="Search customers..." className="w-full bg-transparent px-2 py-2 text-sm outline-none" />
            </form>
            <Link href="/admin/notifications" aria-label="Notifications" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"><Bell size={18} /></Link>
            <details className="relative hidden xl:block">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">Portal previews <ChevronDown size={14} /></summary>
              <nav aria-label="Preview a portal" className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {[['Customer preview','/admin/preview/customer'],['Supplier preview','/admin/preview/supplier'],['Provider preview','/admin/preview/provider'],['Driver preview','/admin/preview/driver']].map(([label,href]) => <Link key={href} href={href} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-800">{label}</Link>)}
              </nav>
            </details>
            <SignOutButton />
          </div>
        </header>
        <details className="border-b border-slate-200 bg-white lg:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold"><Menu size={18} /> Administration menu</summary>
          {renderAdminNavigation(true)}
        </details>
        <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden border-r border-slate-200 bg-white lg:block">{renderAdminNavigation()}</aside>
          <main className="min-w-0 p-4 sm:p-6 xl:p-7">{children}</main>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b bg-white">
        <div className="container-shell flex flex-col gap-3 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" aria-label="BuildMate Ghana home">
              <BrandLogo />
            </Link>
            <div className="text-sm font-semibold xl:hidden">{title}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showPortalSwitcher && (
              <nav
                aria-label="Preview a portal"
                className="flex flex-wrap items-center gap-2"
              >
                <Link
                  href="/admin"
                  prefetch
                  className="rounded-lg border border-brand-700 bg-brand-700 px-3 py-2 text-xs font-semibold text-white"
                  aria-current="page"
                >
                  Admin Portal
                </Link>
                <Link
                  className={portalLinkClass}
                  href="/admin/preview/customer"
                >
                  Customer preview
                </Link>
                <Link
                  className={portalLinkClass}
                  href="/admin/preview/supplier"
                >
                  Supplier preview
                </Link>
                <Link
                  className={portalLinkClass}
                  href="/admin/preview/provider"
                >
                  Provider preview
                </Link>
                <Link className={portalLinkClass} href="/admin/preview/driver">
                  Driver preview
                </Link>
              </nav>
            )}
            <div className="hidden text-sm font-semibold xl:block">{title}</div>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="container-shell grid gap-6 py-6 lg:grid-cols-[240px_1fr]">
        <aside className="card h-fit p-3">
          {nav.map((item, index) => {
            const label = typeof item === "string" ? item : item.label;
            const itemPath =
              typeof item === "string" ? "" : item.href.split("?")[0];
            const childActive =
              typeof item === "string"
                ? false
                : (item.children?.some((child) => {
                    const childPath = child.href.split("?")[0];
                    return (
                      pathname === childPath ||
                      pathname.startsWith(`${childPath}/`)
                    );
                  }) ?? false);
            const active =
              typeof item === "string"
                ? index === 0
                : isCurrentHref(item.href) ||
                  (!item.href.includes("?") &&
                    index > 0 &&
                    pathname.startsWith(`${itemPath}/`)) ||
                  childActive;
            const className = `block w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"}`;
            return typeof item === "string" ? (
              <span key={label} className={className}>
                {label}
              </span>
            ) : (
              <div key={item.href}>
                <Link
                  href={item.href}
                  prefetch
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  {label}
                </Link>
                {item.children && active && (
                  <div className="ml-3 border-l pl-2">
                    {item.children.map((child) => {
                      const selected = isCurrentHref(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          prefetch
                          aria-current={selected ? "page" : undefined}
                          className={`block rounded-lg px-3 py-2 text-xs ${selected ? "bg-slate-50 font-semibold text-brand-700" : "text-slate-600 hover:bg-slate-50"}`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}
