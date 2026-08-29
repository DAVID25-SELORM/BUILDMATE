import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRedirectForRole } from "@/lib/auth/roles";

export default async function SupportHistoryPage(){
 const supabase=await createClient(),{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login?next=/support");
 const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
 const portalHref=getRedirectForRole(profile?.role);
 const{data,error}=await supabase.from("support_tickets").select("id,ticket_number,subject,category,priority,status,created_at,updated_at").eq("created_by",user.id).order("updated_at",{ascending:false}).limit(100);
 return <main className="container-shell py-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black">My Support Requests</h1><p className="mt-2 text-slate-600">Track conversations and responses from BuildMate Support.</p></div><Link className="btn-secondary" href={portalHref}>Return to portal</Link></div>{error&&<p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">Unable to load support requests: {error.message}</p>}<div className="card mt-6 divide-y">{(data??[]).map(ticket=><Link className="block p-5 hover:bg-slate-50" href={`/support/${ticket.id}`} key={ticket.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><b>{ticket.ticket_number}</b><p className="mt-1 font-semibold">{ticket.subject}</p><p className="mt-1 text-xs capitalize text-slate-500">{ticket.category.replaceAll("_"," ")} · {new Date(ticket.created_at).toLocaleString("en-GH")}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold capitalize">{ticket.status.replaceAll("_"," ")}</span></div></Link>)}{!data?.length&&!error&&<p className="p-8 text-center text-slate-500">You have no support requests yet. Use Get Support to contact us.</p>}</div></main>;
}
