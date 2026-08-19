"use client";

export default function OrdersError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="card p-8 text-center">
      <h1 className="text-xl font-black">We couldn&apos;t load your orders.</h1>
      <p className="mt-2 text-slate-600">
        Please try again. Your orders have not been removed.
      </p>
      <button className="btn-primary mt-5" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
