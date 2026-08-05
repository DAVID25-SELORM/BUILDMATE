"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerSchema } from "@/lib/auth/validation";
import { REGISTERABLE_ROLES, ROLE_LABELS, type RegisterableRole } from "@/lib/auth/roles";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RegisterableRole>("customer");
  const [businessName, setBusinessName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    const result = registerSchema.safeParse({ fullName, phone, email, role, businessName, password, confirmPassword, acceptedTerms });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the form and try again");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: result.data.fullName,
          phone: result.data.phone,
          role: result.data.role,
          business_name: result.data.role === "supplier" ? result.data.businessName : undefined,
          terms_version: "2026-08-05",
          privacy_version: "2026-08-05",
          terms_accepted_at: new Date().toISOString()
        }
      }
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.push(result.data.role === "supplier" ? "/supplier" : "/dashboard");
      router.refresh();
      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(result.data.email)}`);
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-3xl font-black">Create your account</h1>
      <p className="mt-2 text-slate-600">Choose the account that matches how you build or sell.</p>
      <form className="mt-8 space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="label" htmlFor="fullName">Full name</label>
          <input id="fullName" className="input" placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input id="phone" className="input" placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input id="email" className="input" type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="role">Account type</label>
          <select id="role" className="input" value={role} onChange={(event) => setRole(event.target.value as RegisterableRole)}>
            {REGISTERABLE_ROLES.map((value) => (
              <option key={value} value={value}>{ROLE_LABELS[value]}</option>
            ))}
          </select>
        </div>
        {role === "supplier" && (
          <div>
            <label className="label" htmlFor="businessName">Business / company name</label>
            <input id="businessName" className="input" placeholder="Business name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} required />
          </div>
        )}
        <div>
          <label className="label" htmlFor="password">Create password</label>
          <input id="password" className="input" type="password" placeholder="Create password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirmPassword">Confirm password</label>
          <input id="confirmPassword" className="input" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required autoComplete="new-password" />
        </div>
        <label className="flex items-start gap-3 text-sm text-slate-600">
          <input className="mt-1" type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required />
          <span>I agree to the <Link className="font-semibold text-brand-700" href="/terms" target="_blank">Terms of Use</Link> and acknowledge the <Link className="font-semibold text-brand-700" href="/privacy" target="_blank">Privacy Notice</Link>.</span>
        </label>
        {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
        <button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        Already registered? <Link className="font-semibold text-brand-700" href="/login">Sign in</Link>
      </p>
    </div>
  );
}
