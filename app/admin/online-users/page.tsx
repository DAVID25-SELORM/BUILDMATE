import { OnlineUsersPanel, type PresenceRow } from "@/components/admin/presence/OnlineUsersPanel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ADMIN_NAV } from "@/lib/admin/navigation";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function OnlineUsersPage(){
  await requirePermission({permission:"platform.users.view"});
  const {data,error}=await (await createClient()).rpc("admin_list_user_presence");
  return <DashboardShell title="Platform administration" nav={[...ADMIN_NAV]}><h1 className="text-3xl font-black">Online users</h1><p className="mt-2 text-slate-600">Authenticated sessions update automatically. A user is online when a heartbeat was received in the last two minutes.</p>{error&&<div className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">Unable to load presence: {error.message}</div>}<OnlineUsersPanel initialRows={(data??[]) as PresenceRow[]}/></DashboardShell>;
}
