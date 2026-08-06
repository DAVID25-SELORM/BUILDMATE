import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("admin_portal_preview")?.value;
  if (sessionId) await (await createClient()).rpc("end_admin_portal_preview", { target_session: sessionId });
  cookieStore.delete("admin_portal_preview");
  const formData = await request.formData();
  const requested = String(formData.get("returnTo") ?? "/admin");
  const returnTo = /^\/admin\/(customers|suppliers)\/[0-9a-f-]+$/i.test(requested) ? requested : "/admin";
  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
