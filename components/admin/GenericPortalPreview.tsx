import Link from "next/link";
import { requireRole } from "@/lib/auth/session";

const content = {
  customer: {
    title: "Customer portal preview",
    description: "A safe product walkthrough with demo-only activity.",
    cards: [
      ["Open orders", "0"],
      ["Saved suppliers", "0"],
      ["Service requests", "0"],
    ],
    actions: [
      "Browse marketplace",
      "Request a quotation",
      "Find a professional",
    ],
  },
  supplier: {
    title: "Supplier portal preview",
    description:
      "A safe supplier workspace walkthrough with no organisation data.",
    cards: [
      ["Products", "0"],
      ["Orders", "0"],
      ["Low stock", "0"],
    ],
    actions: ["Add a product", "Receive stock", "Review orders"],
  },
  provider: {
    title: "Service provider preview",
    description:
      "A safe provider workspace walkthrough with demo-only requests.",
    cards: [
      ["New requests", "0"],
      ["Jobs in progress", "0"],
      ["Reviews", "0"],
    ],
    actions: ["Set availability", "Review requests", "Update profile"],
  },
  driver: {
    title: "Driver portal preview",
    description:
      "A safe driver workspace walkthrough with no live delivery data.",
    cards: [
      ["Assigned deliveries", "0"],
      ["Completed today", "0"],
      ["Vehicle alerts", "0"],
    ],
    actions: ["Set availability", "Review assignments", "Inspect vehicle"],
  },
} as const;

export async function GenericPortalPreview({
  type,
}: {
  type: keyof typeof content;
}) {
  await requireRole(["admin", "super_admin"]);
  const preview = content[type];
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <b>Generic preview — read only.</b> No real customer, supplier,
          provider, order, payment, or inventory data is loaded. To investigate
          a real account, start an audited support view from that account&apos;s
          admin record.
        </div>
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-brand-700">
              BuildMate product preview
            </p>
            <h1 className="mt-1 text-3xl font-black">{preview.title}</h1>
            <p className="mt-2 text-slate-600">{preview.description}</p>
          </div>
          <Link className="btn-secondary" href="/admin">
            Return to admin
          </Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {preview.cards.map(([label, value]) => (
            <div className="card p-5" key={label}>
              <p className="text-sm text-slate-600">{label}</p>
              <p className="mt-2 text-3xl font-black">{value}</p>
            </div>
          ))}
        </div>
        <section className="card mt-6 p-6">
          <h2 className="text-xl font-bold">What this portal can do</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {preview.actions.map((action) => (
              <button
                className="rounded-xl border border-slate-200 p-4 text-left font-semibold text-slate-500"
                disabled
                key={action}
              >
                {action}
                <span className="mt-1 block text-xs font-normal">
                  Disabled in generic preview
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
