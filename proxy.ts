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
  let accountStatus: string | null = null;
  let hasPlatformAccess = false;
  let hasSupplierAccess = false;
  if (isProtected || isAuthPath) {
    const { data: profile } = await supabase.from("profiles").select("role,account_status").eq("id", user.id).single();
    role = profile?.role ?? null;
    accountStatus = profile?.account_status ?? null;
    if (matchesPrefix(path, ["/admin"]) || isAuthPath) {
      const { data } = await supabase.rpc("has_platform_access");
      hasPlatformAccess = data === true;
    }
    if (matchesPrefix(path,["/supplier"]) || isAuthPath) {
      const {data}=await supabase.rpc("has_supplier_access");
      hasSupplierAccess=data===true;
    }
  }

  if (["suspended","deactivated"].includes(accountStatus??"") && path!=="/account-restricted") return NextResponse.redirect(new URL("/account-restricted",request.url));

  if (isAuthPath) {
    return NextResponse.redirect(new URL(hasPlatformAccess ? "/admin" : getRedirectForRole(role), request.url));
  }

  if (matchesPrefix(path, ["/admin"]) && !hasPlatformAccess) {
    return NextResponse.redirect(new URL(getRedirectForRole(role), request.url));
  }

  if (matchesPrefix(path, ["/supplier"]) && !hasSupplierAccess) {
    return NextResponse.redirect(new URL(getRedirectForRole(role), request.url));
  }

  if (matchesPrefix(path, ["/driver"]) && role !== "driver") {
    return NextResponse.redirect(new URL(getRedirectForRole(role), request.url));
  }

  if (matchesPrefix(path, ["/dashboard"]) && role === "driver") {
    return NextResponse.redirect(new URL(getRedirectForRole(role), request.url));
  }

  const previewSession = request.cookies.get("admin_portal_preview")?.value;
  const writeRequest = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const previewLifecycleRequest = [
    "/admin/preview/exit",
    "/admin/preview/quick-start",
  ].includes(path);
  if (previewSession && writeRequest && !previewLifecycleRequest) {
    await supabase.rpc("log_admin_portal_preview_access", {
      target_session: previewSession,
      target_route: path,
      target_action: "preview_write_blocked",
    });
    return NextResponse.json(
      { error: "This action is unavailable in Admin Preview Mode." },
      { status: 403 },
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
