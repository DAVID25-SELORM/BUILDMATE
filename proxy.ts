import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRedirectForRole } from "@/lib/auth/roles";

const PROTECTED_PREFIXES = ["/dashboard", "/supplier", "/admin", "/driver"];
const AUTH_PATHS = ["/login", "/register"];

function matchesPrefix(path: string, prefixes: string[]) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = matchesPrefix(path, PROTECTED_PREFIXES);
  const isAuthPath = matchesPrefix(path, AUTH_PATHS);

  if (!user) {
    if (isProtected) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirect", path);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  let role: string | null = null;
  if (isProtected || isAuthPath) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    role = profile?.role ?? null;
  }

  if (isAuthPath) {
    return NextResponse.redirect(new URL(getRedirectForRole(role), request.url));
  }

  if (matchesPrefix(path, ["/admin"]) && role !== "admin" && role !== "super_admin") {
    return NextResponse.redirect(new URL(getRedirectForRole(role), request.url));
  }

  if (matchesPrefix(path, ["/supplier"]) && role !== "supplier") {
    return NextResponse.redirect(new URL(getRedirectForRole(role), request.url));
  }

  if (matchesPrefix(path, ["/driver"]) && role !== "driver") {
    return NextResponse.redirect(new URL(getRedirectForRole(role), request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
