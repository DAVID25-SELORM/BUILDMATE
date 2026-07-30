import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-black">Link expired or invalid</h1>
        <p className="mt-4 text-slate-600">
          This confirmation or password reset link is no longer valid. Request a new one to continue.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/forgot-password" className="btn-primary">Request password reset</Link>
          <Link href="/login" className="btn-secondary">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
