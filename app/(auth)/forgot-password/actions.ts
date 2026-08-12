"use server";

import { createHash } from "node:crypto";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import { sendNotification } from "@/lib/notifications/sender";
import { createAdminClient } from "@/lib/supabase/admin";

type ResetRequestResult = { ok: true } | { ok: false; error: string };

export async function sendPasswordReset(email: string): Promise<ResetRequestResult> {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) return { ok: false, error: "Enter a valid email address" };

  try {
    const admin = createAdminClient();
    const emailHash = createHash("sha256").update(parsed.data.email.trim().toLowerCase()).digest("hex");
    const { data: allowed, error: throttleError } = await admin.rpc("claim_password_reset_rate_limit", {
      target_email_hash: emailHash,
      minimum_interval_seconds: 60,
    });
    // Return the same result for throttled, unknown, and registered addresses.
    if (throttleError || !allowed) return { ok: true };
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
    });

    // Keep the response identical when the address is not registered.
    if (error || !data.properties?.hashed_token) return { ok: true };

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://buildmate-six.vercel.app").replace(/\/$/, "");
    const resetUrl = `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=${encodeURIComponent("/reset-password")}`;

    await sendNotification({
      channel: "email",
      template_key: "password_reset",
      payload: { resetUrl },
      recipient_email: parsed.data.email,
      recipient_phone: null,
    });

    return { ok: true };
  } catch {
    // Do not disclose whether this address has an account or whether delivery failed.
    return { ok: true };
  }
}
