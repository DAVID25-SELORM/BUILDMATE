"use server";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
export type TenantDataState={ok?:boolean;message:string};
export async function requestTenantDataAction(_:TenantDataState,formData:FormData):Promise<TenantDataState>{
  const organisationId=String(formData.get("organisationId")??"");
  const requestType=String(formData.get("requestType")??"");
  const reason=String(formData.get("reason")??"").trim();
  if(!/^[0-9a-f-]{36}$/i.test(organisationId)||!["export","closure"].includes(requestType))return{message:"Invalid request."};
  if(requestType==="closure"&&reason.length<5)return{message:"Provide a clear closure reason."};
  const{error}=await(await createClient()).rpc("request_tenant_data_action",{target_organisation:organisationId,target_type:requestType,target_reason:reason});
  if(error)return{message:error.message};
  revalidatePath("/supplier/settings");revalidatePath("/dashboard/organisation/settings");
  return{ok:true,message:requestType==="export"?"Export request recorded. An administrator will prepare the secure archive.":"Closure request recorded. Organisation access is now disabled."};
}
