import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";

type NavItem = string | { label: string; href: string };

export function DashboardShell({ title, nav, children }: { title: string; nav: NavItem[]; children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100"><header className="border-b bg-white"><div className="container-shell flex items-center justify-between py-4"><Link href="/" className="font-black text-brand-700">BuildMate</Link><div className="flex items-center gap-4"><div className="text-sm font-semibold">{title}</div><SignOutButton /></div></div></header><div className="container-shell grid gap-6 py-6 lg:grid-cols-[240px_1fr]"><aside className="card h-fit p-3">{nav.map((item, index) => {
    const label = typeof item === "string" ? item : item.label;
    const className = `block w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${index === 0 ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50"}`;
    return typeof item === "string" ? <span key={label} className={className}>{label}</span> : <Link key={item.href} href={item.href} className={className}>{label}</Link>;
  })}</aside><main>{children}</main></div></div>;
}
