"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
const publicLinks = [
  { label: "Shop", href: "/shop" },
  { label: "Services", href: "/services" },
  { label: "Categories", href: "/#categories" },
  { label: "Request Quote", href: "/request-quote", documentNavigation: true },
  { label: "Calculators", href: "/calculators" },
  { label: "Suppliers", href: "/suppliers/nana-attakorah", documentNavigation: true },
  { label: "Get Support", href: "/contact" },
];
export function MobileMenu({ signedIn, accountHref, accountLabel }: { signedIn: boolean; accountHref: string; accountLabel: string }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", key);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="rounded-xl p-2 lg:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <div
          className="fixed inset-0 top-[73px] z-[90] bg-slate-950/40 lg:hidden"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <div
            ref={panel}
            className="absolute right-3 top-3 w-[min(90vw,340px)] rounded-2xl bg-white p-3 shadow-2xl"
            role="dialog"
            aria-label="Mobile navigation"
          >
            {publicLinks.map(({ label, href, documentNavigation }) =>
              documentNavigation ? (
                <a key={href} href={href} data-navigation="document" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 font-semibold text-slate-800 hover:bg-brand-50 hover:text-brand-800">
                  {label}
                </a>
              ) : (
                <Link key={href} href={href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 font-semibold text-slate-800 hover:bg-brand-50 hover:text-brand-800">
                  {label}
                </Link>
              ),
            )}
            {signedIn ? (
              <>
                <Link href={accountHref} onClick={() => setOpen(false)} className="block rounded-xl bg-brand-50 px-4 py-3 font-semibold text-brand-800">{accountLabel}</Link>
                <SignOutButton className="mt-2 w-full" />
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 font-semibold text-slate-800 hover:bg-brand-50 hover:text-brand-800">Sign in</Link>
                <Link href="/register" onClick={() => setOpen(false)} className="mt-2 block rounded-xl bg-brand-700 px-4 py-3 text-center font-semibold text-white">Get started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
