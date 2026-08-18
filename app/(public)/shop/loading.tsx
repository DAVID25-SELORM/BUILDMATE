export default function ShopLoading() {
  return (
    <section
      className="container-shell py-8 sm:py-12"
      aria-label="Loading marketplace"
    >
      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-10 w-72 max-w-full animate-pulse rounded bg-slate-200" />
      <div className="mt-6 h-28 animate-pulse rounded-2xl bg-slate-100" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="card overflow-hidden" key={index}>
            <div className="h-44 animate-pulse bg-slate-200" />
            <div className="space-y-3 p-5">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-8 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-10 animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
