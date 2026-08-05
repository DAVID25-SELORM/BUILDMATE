import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { acceptQuote } from "../actions";

export default async function QuoteComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { user } = await requireUser(); const supabase = await createClient();
  const { data: request } = await supabase.from("quote_requests").select("id,title,delivery_location,required_date,status,quote_request_items(description)").eq("id", id).eq("requester_id", user.id).maybeSingle();
  if (!request) notFound();
  const { data: quotes } = await supabase.from("supplier_quotes").select("id,subtotal,delivery_fee,total,delivery_days,notes,status,organisations(name)").eq("quote_request_id", id).order("total");
  return <DashboardShell title="Customer workspace" nav={[{ label: "Overview", href: "/dashboard" }, { label: "Quotations", href: "/dashboard/quotes" }]}>
    <h1 className="text-3xl font-black">{request.title}</h1><p className="mt-2 text-slate-600">{request.delivery_location} · {request.required_date ?? "Flexible date"}</p>
    <div className="card mt-6 p-6"><h2 className="font-bold">Requested materials</h2><ul className="mt-3 list-disc pl-5 text-sm">{request.quote_request_items.map(item => <li key={item.description}>{item.description}</li>)}</ul></div>
    <h2 className="mt-8 text-2xl font-bold">Supplier comparison</h2><div className="mt-4 grid gap-4 lg:grid-cols-3">{(quotes ?? []).map(quote => { const supplier = quote.organisations as unknown as { name: string } | null; return <article className="card p-6" key={quote.id}><p className="font-semibold text-brand-700">{supplier?.name ?? "Supplier"}</p><p className="mt-3 text-3xl font-black">GHS {Number(quote.total).toFixed(2)}</p><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><dt>Materials</dt><dd>{Number(quote.subtotal).toFixed(2)}</dd></div><div className="flex justify-between"><dt>Delivery</dt><dd>{Number(quote.delivery_fee).toFixed(2)}</dd></div><div className="flex justify-between"><dt>Lead time</dt><dd>{quote.delivery_days} days</dd></div></dl>{quote.notes && <p className="mt-4 text-sm text-slate-600">{quote.notes}</p>}{request.status === "open" && <form className="mt-5" action={acceptQuote.bind(null, quote.id)}><button className="btn-primary w-full">Accept quote</button></form>}</article>; })}{(quotes ?? []).length === 0 && <div className="card p-8 text-slate-500">No supplier responses yet.</div>}</div>
  </DashboardShell>;
}
