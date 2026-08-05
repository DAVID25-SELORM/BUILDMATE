import Link from "next/link";
import { HardHat, Menu, ShoppingCart } from "lucide-react";

const links = [
  ["Shop Materials", "/shop"],
  ["Request Quote", "/request-quote"],
  ["Calculators", "/calculators"],
  ["About", "/about"],
  ["Contact", "/contact"]
];

export function Header() {
  return <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
    <div className="container-shell flex h-18 items-center justify-between py-4">
      <Link href="/" className="flex items-center gap-2 font-bold text-brand-700"><HardHat className="h-7 w-7"/><span className="text-xl">BuildMate</span></Link>
      <nav className="hidden items-center gap-6 lg:flex">{links.map(([label, href]) => <Link key={href} href={href} className="text-sm font-medium text-slate-700 hover:text-brand-700">{label}</Link>)}</nav>
      <div className="flex items-center gap-2">
        <Link href="/login" className="hidden rounded-xl px-4 py-2 text-sm font-semibold sm:block">Sign in</Link>
        <Link href="/register" className="btn-primary py-2.5 text-sm">Get started</Link>
        <button className="rounded-xl p-2 lg:hidden" aria-label="Open menu"><Menu /></button>
        <Link href="/cart" className="rounded-xl p-2" aria-label="Cart"><ShoppingCart /></Link>
      </div>
    </div>
  </header>;
}
