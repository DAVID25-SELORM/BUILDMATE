"use server";

import { createClient } from "@/lib/supabase/server";
import { hashInvitationToken } from "@/lib/invitations/token";

export type AcceptState = { error?: string; redirectTo?: string } | null;

export async function acceptInvitation(token: string, previous: AcceptState, formData: FormData): Promise<AcceptState> {
  void previous;
  void formData;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { target_token_hash: hashInvitationToken(token) });
  if (error) return { error: error.message };
  const scope = (data as { scope?: string } | null)?.scope;
  return { redirectTo: scope === "platform" ? "/admin/staff" : "/dashboard" };
}
