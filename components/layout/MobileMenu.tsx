"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
const links = [
  ["Shop", "/shop"],
  ["Services", "/services"],
  ["Categories", "/#categories"],
  ["Request Quote", "/request-quote"],
  ["Calculators", "/calculators"],
  ["Suppliers", "/suppliers/nana-attakorah"],
  ["My Account", "/dashboard"],
  ["Get Support", "/contact"],
  ["Sign in", "/login"],
];
export function MobileMenu() {
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
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-4 py-3 font-semibold text-slate-800 hover:bg-brand-50 hover:text-brand-800"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
