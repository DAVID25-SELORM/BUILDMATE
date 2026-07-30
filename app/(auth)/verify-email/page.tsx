import Link from "next/link";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="w-full max-w-md text-center">
      <h1 className="text-3xl font-black">Check your email</h1>
      <p className="mt-4 text-slate-600">
        We sent a confirmation link{email ? (
          <>
            {" "}to <span className="font-semibold text-slate-900">{email}</span>
          </>
        ) : null}. Click the link to activate your account, then sign in.
      </p>
      <Link href="/login" className="btn-primary mt-8 inline-flex">Back to sign in</Link>
    </div>
  );
}
