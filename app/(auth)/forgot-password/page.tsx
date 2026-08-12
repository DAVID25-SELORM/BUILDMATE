"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { forgotPasswordSchema } from "@/lib/auth/validation";
import { sendPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }

    setLoading(true);
    const resetResult = await sendPasswordReset(result.data.email);
    setLoading(false);

    if (!resetResult.ok) {
      setError(resetResult.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-black">Check your email</h1>
        <p className="mt-4 text-slate-600">
          If an account exists for <span className="font-semibold text-slate-900">{email}</span>, a password reset link is on its way.
        </p>
        <Link href="/login" className="btn-primary mt-8 inline-flex">Back to sign in</Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-black">Reset your password</h1>
      <p className="mt-2 text-slate-600">Enter the email on your account and we will send you a reset link.</p>
      <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>
        {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link className="font-semibold text-brand-700" href="/login">Back to sign in</Link>
      </p>
    </div>
  );
}
