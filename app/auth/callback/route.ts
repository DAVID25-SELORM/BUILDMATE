import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRedirectForRole } from "@/lib/auth/roles";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      if (next) return NextResponse.redirect(new URL(getSafeRedirectPath(next, "/"), origin));
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      return NextResponse.redirect(new URL(getRedirectForRole(profile?.role), origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-code-error", origin));
}
