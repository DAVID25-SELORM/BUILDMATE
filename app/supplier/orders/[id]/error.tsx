"use client";

import Link from "next/link";

export default function SupplierOrderError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="card mx-auto max-w-2xl p-8 text-center"><h1 className="text-3xl font-black">We couldn&apos;t open this order</h1><p className="mt-3 text-slate-600">The order may no longer be available to this supplier account, or a temporary data error occurred. No order action was performed.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button className="btn-primary" onClick={reset}>Try again</button><Link className="btn-secondary" href="/supplier/orders">Return to orders</Link><Link className="btn-secondary" href="/support">Contact support</Link></div></div>;
}
