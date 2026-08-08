import Link from "next/link";
export function Footer() {
  return <footer className="mt-20 bg-slate-950 text-slate-300"><div className="container-shell grid gap-10 py-14 md:grid-cols-4">
    <div><h3 className="text-xl font-bold text-white">BuildMate Ghana</h3><p className="mt-3 text-sm leading-6">Verified materials, transparent quotations and coordinated delivery for every building project.</p></div>
    <div><h4 className="font-semibold text-white">Marketplace</h4><div className="mt-3 space-y-2 text-sm"><Link href="/shop" className="block">Shop</Link><Link href="/request-quote" className="block">Request Quote</Link><Link href="/calculators" className="block">Calculators</Link></div></div>
    <div><h4 className="font-semibold text-white">Company</h4><div className="mt-3 space-y-2 text-sm"><Link href="/about" className="block">About</Link><Link href="/contact" className="block">Contact</Link><Link href="/register" className="block">Supplier onboarding</Link></div></div>
    <div><h4 className="font-semibold text-white">Legal & support</h4><div className="mt-3 space-y-2 text-sm"><Link className="block" href="/terms">Terms</Link><Link className="block" href="/privacy">Privacy</Link><Link className="block" href="/refunds">Refunds & disputes</Link><Link className="block" href="/acceptable-use">Acceptable use</Link></div></div>
  </div><div className="border-t border-slate-800 py-5 text-center text-xs">© {new Date().getFullYear()} BuildMate Ghana. All rights reserved.</div></footer>;
}
