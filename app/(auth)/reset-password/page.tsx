"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/auth/validation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setChecking(false);
    });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the password fields");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: result.data.password });

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    // A recovery link creates a real session. End it after the password change
    // so the login page is reachable and the user explicitly authenticates with
    // the new credential.
    const { error: signOutError } = await supabase.auth.signOut();
    setLoading(false);
    if (signOutError) {
      setError("Your password was updated, but we could not sign you out. Please sign out before continuing.");
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.replace("/login?reset=success");
      router.refresh();
    }, 1500);
  }

  if (checking) {
    return <p className="text-sm text-slate-600">Checking your reset link...</p>;
  }

  if (!hasSession) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-black">Link expired</h1>
        <p className="mt-4 text-slate-600">This password reset link is invalid or has expired.</p>
        <Link href="/forgot-password" className="btn-primary mt-8 inline-flex">Request a new link</Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-black">Password updated</h1>
        <p className="mt-4 text-slate-600">Redirecting you to sign in...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-black">Choose a new password</h1>
      <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label" htmlFor="confirmPassword">Confirm new password</label>
          <input
            id="confirmPassword"
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
