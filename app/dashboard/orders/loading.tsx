export default function OrdersLoading() {
  return (
    <div className="space-y-3" aria-label="Loading orders">
      <div className="h-10 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}
