import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type PortalType = "customer" | "supplier";

async function findQuickPreviewTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  portalType: PortalType
): Promise<string | null> {
  if (portalType === "customer") {
    const { data } = await supabase.rpc("admin_list_customers", {
      search_text: null,
      role_filter: null,
      status_filter: "active",
      region_filter: null,
      registered_from: null,
      registered_to: null,
      min_spend: null,
      sort_by: "newest",
      page_number: 1,
      page_size: 1
    });
    const row = (data as { id: string }[] | null)?.[0];
    if (row) return row.id;

    const { data: any } = await supabase.rpc("admin_list_customers", {
      search_text: null,
      role_filter: null,
      status_filter: null,
      region_filter: null,
      registered_from: null,
      registered_to: null,
      min_spend: null,
      sort_by: "newest",
      page_number: 1,
      page_size: 1
    });
    return (any as { id: string }[] | null)?.[0]?.id ?? null;
  }

  const { data } = await supabase.rpc("admin_list_suppliers_v2", {
    search_text: null,
    status_filter: "approved",
    verification_level_filter: null,
    region_filter: null,
    category_filter: null,
    performance_filter: null,
    registered_from: null,
    registered_to: null,
    sort_by: "newest",
    page_number: 1,
    page_size: 1
  });
  const row = (data as { id: string }[] | null)?.[0];
  if (row) return row.id;

  const { data: any } = await supabase.rpc("admin_list_suppliers_v2", {
    search_text: null,
    status_filter: null,
    verification_level_filter: null,
    region_filter: null,
    category_filter: null,
    performance_filter: null,
    registered_from: null,
    registered_to: null,
    sort_by: "newest",
    page_number: 1,
    page_size: 1
  });
  return (any as { id: string }[] | null)?.[0]?.id ?? null;
}

export async function POST(request: Request) {
  await requireRole(["admin", "super_admin"]);

  const formData = await request.formData();
  const portalType: PortalType = formData.get("portalType") === "supplier" ? "supplier" : "customer";
  const supabase = await createClient();
  const listFallback = portalType === "customer" ? "/admin/customers?portal=customer" : "/admin/suppliers?portal=supplier";

  const targetId = await findQuickPreviewTarget(supabase, portalType);
  if (!targetId) {
    return NextResponse.redirect(new URL(listFallback, request.url), 303);
  }

  const h = await headers();
  const { data: sessionId, error } = await supabase.rpc("start_admin_portal_preview", {
    target_portal: portalType,
    target_user: portalType === "customer" ? targetId : null,
    target_organisation: portalType === "supplier" ? targetId : null,
    target_reason: "Quick portal switch from admin header (UI review)",
    target_reference: null,
    request_ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    request_user_agent: h.get("user-agent") ?? null
  });

  if (error || !sessionId) {
    return NextResponse.redirect(new URL(listFallback, request.url), 303);
  }

  (await cookies()).set("admin_portal_preview", String(sessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 1800
  });

  return NextResponse.redirect(new URL(`/admin/preview/${portalType}/${targetId}`, request.url), 303);
}
