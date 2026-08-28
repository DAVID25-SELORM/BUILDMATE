import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { CartLink } from "@/components/commerce/CartLink";
import { MobileMenu } from "@/components/layout/MobileMenu";

const links = [
  { label: "Shop", href: "/shop" },
  { label: "Services", href: "/services" },
  { label: "Categories", href: "/#categories" },
  { label: "Request Quote", href: "/request-quote", documentNavigation: true },
  { label: "Calculators", href: "/calculators" },
  { label: "Suppliers", href: "/suppliers/nana-attakorah", documentNavigation: true },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-shell flex h-18 items-center justify-between py-4">
        <Link href="/" aria-label="BuildMate Ghana home">
          <BrandLogo />
        </Link>
        <nav className="hidden items-center gap-6 lg:flex">
          {links.map(({ label, href, documentNavigation }) =>
            documentNavigation ? (
              <a key={href} href={href} data-navigation="document" className="text-sm font-medium text-slate-700 hover:text-brand-700">
                {label}
              </a>
            ) : (
              <Link key={href} href={href} className="text-sm font-medium text-slate-700 hover:text-brand-700">
                {label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-xl px-4 py-2 text-sm font-semibold sm:block"
          >
            Sign in
          </Link>
          <Link href="/register" className="btn-primary py-2.5 text-sm">
            Get started
          </Link>
          <MobileMenu />
          <CartLink />
        </div>
      </div>
    </header>
  );
}
