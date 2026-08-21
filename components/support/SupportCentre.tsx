"use client";
import Link from "next/link";
import { HelpCircle, Search, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createSupportTicket } from "@/app/support/actions";

const topics=["How do I buy a product?","How do I compare suppliers?","What does ‘Confirm availability’ mean?","How do I request a quotation?","How do I track an order?","Can I cancel an order?","What happens with partial delivery?","How do refunds work?","Can I collect from the supplier?","How do I become a supplier?","How do suppliers update stock?"];
const categories=[["shopping_products","Shopping & products"],["quotations","Quotations"],["orders","Orders"],["payments","Payments"],["delivery","Delivery"],["returns_refunds","Returns & refunds"],["supplier_support","Supplier support"],["driver_support","Driver support"],["service_provider_support","Service-provider support"],["account_login","Account & login"],["technical_problem","Technical problem"]] as const;

export function SupportCentre(){
 const pathname=usePathname(),previewMode=/^\/admin\/preview\/(customer|supplier|driver|provider)(?:\/|$)/.test(pathname),normalAdmin=pathname.startsWith("/admin")&&!previewMode;
 const[open,setOpen]=useState(false),[query,setQuery]=useState(""),[selectedCategory,setSelectedCategory]=useState(suggestCategory(pathname));
 const[ticketState,ticketAction,ticketPending]=useActionState(createSupportTicket,{});
 const close=useRef<HTMLButtonElement>(null),matches=useMemo(()=>topics.filter(topic=>topic.toLowerCase().includes(query.toLowerCase())),[query]);
 useEffect(()=>{if(open)close.current?.focus();},[open]);
 if(normalAdmin)return null;
 return <><button type="button" className="fixed bottom-5 right-4 z-[70] inline-flex items-center gap-2 rounded-full bg-brand-800 px-4 py-3 font-bold text-white shadow-xl hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 sm:bottom-6 sm:right-6" onClick={()=>setOpen(true)} aria-haspopup="dialog"><HelpCircle className="h-5 w-5"/>Get Support</button>
 {open&&<div className="fixed inset-0 z-[80] bg-slate-950/45" onMouseDown={event=>{if(event.currentTarget===event.target)setOpen(false);}}><section role="dialog" aria-modal="true" aria-labelledby="support-title" className="absolute bottom-0 right-0 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-24 shadow-2xl sm:bottom-6 sm:right-6 sm:w-[430px] sm:rounded-3xl sm:pb-6">
  <div className="flex items-start justify-between"><div><h2 id="support-title" className="text-2xl font-black">How can we help?</h2><p className="mt-1 text-sm text-slate-600">Find guidance or contact BuildMate Support.</p></div><button ref={close} type="button" className="rounded-lg p-2" aria-label="Close support centre" onClick={()=>setOpen(false)}><X/></button></div>
  <label className="relative mt-5 block"><span className="sr-only">Search help</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input className="input pl-10" placeholder="Search help" value={query} onChange={event=>setQuery(event.target.value)}/></label>
  <div className="mt-5 flex flex-wrap gap-2">{categories.map(([,label])=><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold" key={label}>{label}</span>)}</div>
  <div className="mt-6 space-y-2">{matches.map(topic=><details className="rounded-xl border p-3" key={topic}><summary className="cursor-pointer font-semibold">{topic}</summary><p className="mt-2 text-sm text-slate-600">Visit the relevant product, quotation, order, or account page for the available action. If you still need help, send BuildMate the details below.</p></details>)}</div>
  <div className="mt-6 border-t pt-5"><h3 className="text-lg font-black">Still need help?</h3><p className="mt-1 text-sm text-slate-600">Create a request and track the response in your Support Centre.</p></div>
  {previewMode?<button className="btn-primary mt-6 w-full opacity-60" disabled>Preview only — no support request will be submitted</button>:<form action={ticketAction} className="mt-4 space-y-3">
   <input type="hidden" name="sourceRoute" value={pathname}/><SupportRouteContext pathname={pathname}/>
   <label className="block"><span className="label">Problem</span><select className="input" name="category" value={selectedCategory} onChange={event=>setSelectedCategory(event.target.value)} required>{categories.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
   <label className="block"><span className="label">Subject</span><input className="input" name="subject" minLength={5} maxLength={160} required/></label>
   <label className="block"><span className="label">Details</span><textarea className="input" name="description" rows={4} minLength={10} maxLength={5000} required/></label>
   <label className="block"><span className="label">Priority</span><select className="input" name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
   {["payments","orders"].includes(selectedCategory)&&<p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-950">BuildMate orders are currently Cash on Delivery. Do not make advance payment outside the approved BuildMate order process.</p>}
   <button className="btn-primary w-full" disabled={ticketPending}>{ticketPending?"Creating request…":"Contact BuildMate Support"}</button>
   {ticketState.error&&<p className="text-sm font-semibold text-red-700">{ticketState.error}</p>}{ticketState.message&&<p className="text-sm font-semibold text-emerald-700">{ticketState.message}</p>}
   <Link href={ticketState.ticketId?`/support/${ticketState.ticketId}`:"/support"} className="block text-center text-sm font-bold text-brand-700" onClick={()=>setOpen(false)}>{ticketState.ticketId?"Open support request":"My Support Requests"}</Link>
  </form>}
 </section></div>}</>;
}
function suggestCategory(pathname:string){if(pathname.includes("deliver"))return"delivery";if(pathname.includes("quotation")||pathname.includes("quote"))return"quotations";if(pathname.includes("order"))return"orders";if(pathname.includes("payment")||pathname.includes("settlement"))return"payments";if(pathname.startsWith("/supplier"))return"supplier_support";if(pathname.startsWith("/driver"))return"driver_support";if(pathname.startsWith("/provider"))return"service_provider_support";if(pathname.startsWith("/shop")||pathname.includes("product"))return"shopping_products";return"technical_problem";}
function SupportRouteContext({pathname}:{pathname:string}){const matchers:[RegExp,string][]=[[/^\/dashboard\/orders\/([0-9a-f-]{36})$/i,"orderId"],[/^\/supplier\/orders\/([0-9a-f-]{36})$/i,"orderId"],[/^\/dashboard\/quotes\/([0-9a-f-]{36})$/i,"quoteId"]];for(const[pattern,name]of matchers){const id=pathname.match(pattern)?.[1];if(id)return <input type="hidden" name={name} value={id}/>;}return null;}
