"use client";
import {useActionState} from "react";
import {requestTenantDataAction,type TenantDataState} from "@/app/tenant-data-actions";

const initial:TenantDataState={message:""};
export function TenantDataControls({organisationId}:{organisationId:string}){
  const[actionState,action,pending]=useActionState(requestTenantDataAction,initial);
  return <section className="card mt-6 p-5"><h2 className="text-xl font-bold">Data and account lifecycle</h2><p className="mt-2 text-sm text-slate-600">Exports are prepared for the active organisation only. Closure requests disable tenant access and enter the statutory retention workflow.</p><form action={action} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]"><input type="hidden" name="organisationId" value={organisationId}/><input className="input" name="reason" minLength={5} placeholder="Reason or internal reference"/><button className="btn-secondary" name="requestType" value="export" disabled={pending}>Request data export</button><button className="rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-700" name="requestType" value="closure" disabled={pending}>Request closure</button></form>{actionState.message&&<p className={`mt-3 text-sm ${actionState.ok?"text-green-700":"text-red-700"}`}>{actionState.message}</p>}</section>;
}
