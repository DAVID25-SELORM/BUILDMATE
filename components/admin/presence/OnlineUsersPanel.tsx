"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PresenceRow = { user_id:string;full_name:string;email:string;role:string;current_path:string;last_seen_at:string;session_count:number };
const ONLINE_WINDOW_MS=120_000;

export function OnlineUsersPanel({initialRows}:{initialRows:PresenceRow[]}) {
  const [rows,setRows]=useState(initialRows);
  const [now,setNow]=useState(()=>Date.now());
  const refresh=useCallback(async()=>{const {data}=await createClient().rpc("admin_list_user_presence");if(data)setRows(data as PresenceRow[]);setNow(Date.now())},[]);
  useEffect(()=>{
    const supabase=createClient();
    const channel=supabase.channel("admin-user-presence").on("postgres_changes",{event:"*",schema:"public",table:"user_presence"},()=>void refresh()).subscribe();
    const timer=window.setInterval(()=>void refresh(),30_000);
    return()=>{window.clearInterval(timer);void supabase.removeChannel(channel)};
  },[refresh]);
  const online=useMemo(()=>rows.filter(row=>now-new Date(row.last_seen_at).getTime()<ONLINE_WINDOW_MS),[rows,now]);
  return <>
    <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="card p-5"><p className="text-sm text-slate-500">Online now</p><p className="mt-2 text-3xl font-black text-emerald-700">{online.length}</p></div><div className="card p-5"><p className="text-sm text-slate-500">Active sessions</p><p className="mt-2 text-3xl font-black">{online.reduce((sum,row)=>sum+Number(row.session_count),0)}</p></div></div>
    <div className="card mt-6 overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead><tr className="border-b"><th className="p-4">User</th><th>Role</th><th>Presence</th><th>Current area</th><th>Sessions</th><th>Last seen</th></tr></thead><tbody>{rows.map(row=>{const isOnline=now-new Date(row.last_seen_at).getTime()<ONLINE_WINDOW_MS;return <tr className="border-b last:border-0" key={row.user_id}><td className="p-4"><b>{row.full_name}</b><p className="text-xs text-slate-500">{row.email}</p></td><td className="capitalize">{row.role.replaceAll("_"," ")}</td><td><span className={`inline-flex items-center gap-2 font-semibold ${isOnline?"text-emerald-700":"text-slate-500"}`}><span className={`h-2.5 w-2.5 rounded-full ${isOnline?"bg-emerald-500":"bg-slate-300"}`}/>{isOnline?"Online":"Offline"}</span></td><td>{row.current_path}</td><td>{row.session_count}</td><td>{isOnline?"Now":new Date(row.last_seen_at).toLocaleString()}</td></tr>})}{!rows.length&&<tr><td colSpan={6} className="p-8 text-center text-slate-500">No authenticated activity has been recorded in the last 24 hours.</td></tr>}</tbody></table></div>
  </>;
}
