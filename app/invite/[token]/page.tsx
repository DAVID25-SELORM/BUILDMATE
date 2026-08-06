import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hashInvitationToken } from "@/lib/invitations/token";
import { AcceptInvitationForm } from "@/components/invitations/AcceptInvitationForm";

type InvitationPreview = {
  scope: "platform" | "supplier" | "customer";
  email: string;
  role_label: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
};

export default async function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenHash = hashInvitationToken(token);
  const supabase = await createClient();

  const { data: preview } = await supabase.rpc("get_invitation_preview", { target_token_hash: tokenHash });
  if (!preview) notFound();
  const invitation = preview as InvitationPreview;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const actionable = invitation.status === "pending";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-black">You&apos;re invited to BuildMate</h1>
        <div className="card mt-6 p-6">
          <p className="text-sm text-slate-600">Invited email</p>
          <p className="font-semibold">{invitation.email}</p>
          <p className="mt-4 text-sm text-slate-600">Role</p>
          <p className="font-semibold">{invitation.role_label}</p>

          {!actionable && (
            <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              This invitation is {invitation.status === "expired" ? "expired" : invitation.status}. Ask whoever invited you to send a new one.
            </p>
          )}

          {actionable && !user && (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-slate-600">
                Sign in with the invited email to accept, or create an account first and reopen this link.
              </p>
              <Link href={`/login?redirect=/invite/${token}`} className="btn-primary block text-center">Sign in to accept</Link>
              <Link href="/register" className="btn-secondary block text-center">Create an account</Link>
            </div>
          )}

          {actionable && user && <AcceptInvitationForm token={token} />}
        </div>
      </div>
    </div>
  );
}
