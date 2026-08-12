"use client";

import { useState } from "react";

type Props={label:string;message:string;onConfirm?:()=>void;className?:string;disabled?:boolean;pendingLabel?:string};

export function ConfirmActionButton({label,message,onConfirm,className="btn-secondary",disabled=false,pendingLabel}:Props){
  const [open,setOpen]=useState(false);
  return <>
    <button type="button" className={className} disabled={disabled} onClick={()=>setOpen(true)}>{pendingLabel??label}</button>
    {open&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title" aria-describedby="confirm-action-message"><h2 id="confirm-action-title" className="text-xl font-black text-slate-900">Confirm action</h2><p id="confirm-action-message" className="mt-3 text-sm leading-6 text-slate-600">{message}</p><div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={()=>setOpen(false)}>Cancel</button><button type="button" className="btn-primary" onClick={()=>{setOpen(false);onConfirm?.()}}>{label}</button></div></section></div>}
  </>;
}

export function ConfirmSubmitButton(props:Omit<Props,"onConfirm">){
  const [form,setForm]=useState<HTMLFormElement|null>(null);
  return <span onClick={event=>setForm(event.currentTarget.closest("form"))}><ConfirmActionButton {...props} onConfirm={()=>form?.requestSubmit()}/></span>;
}
