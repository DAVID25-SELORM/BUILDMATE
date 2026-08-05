"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/auth/validation";
import { getRedirectForRole } from "@/lib/auth/roles";
import { getSafeRedirectPath } from "@/lib/auth/redirect";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check your details and try again");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword(result.data);

    if (signInError || !data.user) {
      setLoading(false);
      setError(signInError?.message === "Invalid login credentials" ? "Incorrect email or password" : signInError?.message ?? "Unable to sign in");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    const destination = getSafeRedirectPath(
      searchParams.get("redirect"),
      getRedirectForRole(profile?.role)
    );
    router.replace(destination);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-black">Welcome back</h1>
      <p className="mt-2 text-slate-600">Sign in to manage your projects and orders.</p>
      {searchParams.get("reset") === "success" && (
        <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">
          Your password was updated. Sign in with your new password.
        </p>
      )}
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
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-sm font-semibold text-brand-700">Forgot password?</Link>
          </div>
        </div>
        {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        New to BuildMate? <Link className="font-semibold text-brand-700" href="/register">Create an account</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading...</p>}>
      <LoginForm />
    </Suspense>
  );
}
