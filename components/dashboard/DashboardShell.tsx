"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";

type NavLink = { label: string; href: string };
type NavItem = string | (NavLink & { children?: readonly NavLink[] });

export function DashboardShell({ title, nav, children }: { title: string; nav: NavItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const showPortalSwitcher = title === "Platform administration";
  const customerPortal = pathname.startsWith("/admin/customers");
  const supplierPortal = pathname.startsWith("/admin/suppliers") || pathname.startsWith("/admin/supplier-applications");
  const portalLinkClass = (active: boolean) =>
    `rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${active ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700"}`;
  return <div className="min-h-screen bg-slate-100"><header className="border-b bg-white"><div className="container-shell flex flex-col gap-3 py-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex items-center justify-between gap-4"><Link href="/" className="font-black text-brand-700">BuildMate</Link><div className="text-sm font-semibold xl:hidden">{title}</div></div><div className="flex flex-wrap items-center gap-2">{showPortalSwitcher&&<nav aria-label="Switch portal" className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-semibold text-slate-500">Switch portal</span><Link href="/admin" prefetch className={portalLinkClass(!customerPortal&&!supplierPortal)} aria-current={!customerPortal&&!supplierPortal?"page":undefined}>Admin Portal</Link><Link href="/admin/customers?portal=customer" prefetch className={portalLinkClass(customerPortal)} aria-current={customerPortal?"page":undefined}>Customer Portal</Link><Link href="/admin/suppliers?portal=supplier" prefetch className={portalLinkClass(supplierPortal)} aria-current={supplierPortal?"page":undefined}>Supplier Portal</Link></nav>}<div className="hidden text-sm font-semibold xl:block">{title}</div><SignOutButton /></div></div></header><div className="container-shell grid gap-6 py-6 lg:grid-cols-[240px_1fr]"><aside className="card h-fit p-3">{nav.map((item, index) => {
    const label = typeof item === "string" ? item : item.label;
    const active = typeof item === "string" ? index === 0 : pathname === item.href || (index > 0 && pathname.startsWith(`${item.href}/`));
    const className = `block w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"}`;
    return typeof item === "string" ? <span key={label} className={className}>{label}</span> : <div key={item.href}><Link href={item.href} prefetch className={className}>{label}</Link>{item.children&&active&&<div className="ml-3 border-l pl-2">{item.children.map(child=><Link key={child.href} href={child.href} prefetch className="block rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">{child.label}</Link>)}</div>}</div>;
  })}</aside><main>{children}</main></div></div>;
}
