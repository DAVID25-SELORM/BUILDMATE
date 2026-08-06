"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation, type AcceptState } from "@/app/invite/[token]/actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(acceptInvitation.bind(null, token), null as AcceptState);

  useEffect(() => {
    if (state?.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="mt-6">
      {state?.error && <p className="mb-3 text-sm font-medium text-red-600" role="alert">{state.error}</p>}
      <button className="btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Accepting..." : "Accept invitation"}
      </button>
    </form>
  );
}
