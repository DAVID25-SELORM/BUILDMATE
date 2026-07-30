import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRedirectForRole } from "@/lib/auth/roles";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      return NextResponse.redirect(`${origin}${getRedirectForRole(profile?.role)}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
