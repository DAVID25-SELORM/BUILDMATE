"use client";
import { useActionState } from "react";
import { replySupportTicket } from "@/app/support/actions";

export function SupportReplyForm({ticketId,allowInternal=false}:{ticketId:string;allowInternal?:boolean}){
 const[state,action,pending]=useActionState(replySupportTicket,{});
 return <form action={action} className="card mt-5 p-5"><input type="hidden" name="ticketId" value={ticketId}/><label><span className="label">Reply</span><textarea className="input" name="body" rows={4} maxLength={5000} required/></label>{allowInternal&&<label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="internalNote"/>Internal note — hidden from requester</label>}<button className="btn-primary mt-4" disabled={pending}>{pending?"Sending…":"Send reply"}</button>{state.error&&<p className="mt-3 text-sm font-semibold text-red-700">{state.error}</p>}{state.message&&<p className="mt-3 text-sm font-semibold text-emerald-700">{state.message}</p>}</form>;
}
