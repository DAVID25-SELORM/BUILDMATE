"use server";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {requireUser} from "@/lib/auth/session";
import {listOrganisationChoices,setActiveOrganisationCookie} from "@/lib/organisations/active";
import type {OrganisationScope} from "@/lib/permissions/organisation";
export async function switchActiveOrganisation(scope:OrganisationScope,formData:FormData){const organisationId=String(formData.get("organisationId")??"");const safeRoot=scope==="supplier"?"/supplier":"/dashboard";const returnTo=String(formData.get("returnTo")??safeRoot);const{user}=await requireUser();const supabase=await createClient();const choices=await listOrganisationChoices(supabase,user.id,scope);if(!choices.some(choice=>choice.id===organisationId))throw new Error("You do not have an active membership in this organisation");await setActiveOrganisationCookie(scope,organisationId);redirect(returnTo.startsWith(safeRoot)?returnTo:safeRoot);}
