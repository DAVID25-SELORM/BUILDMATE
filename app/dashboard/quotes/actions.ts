"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
export async function acceptQuote(quoteId:string){await requireUser();const supabase=await createClient();const{data,error}=await supabase.rpc("accept_supplier_quote",{target_quote:quoteId});if(error)throw new Error(error.message);redirect(`/dashboard/orders/${data}`)}
