import { DashboardShell } from "@/components/dashboard/DashboardShell";

export function PortalPreviewShell({
  portalType,
  targetId,
  targetName,
  reason,
  referenceNumber,
  nav,
  children,
}: {
  portalType: "customer" | "supplier";
  targetId: string;
  targetName: string;
  reason: string;
  referenceNumber: string | null;
  nav: { label: string; section?: string }[];
  children: React.ReactNode;
}) {
  const base = `/admin/preview/${portalType}/${targetId}`;
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-30 border-b border-amber-500 bg-amber-300 px-4 py-3 text-amber-950 shadow-sm">
        <div className="container-shell flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <b>ADMIN PREVIEW MODE — READ ONLY</b>
            <span className="ml-3">Viewing {portalType === "customer" ? "Customer" : "Supplier"} Portal: {targetName}</span>
            <span className="ml-3">Reason: {reason}</span>
            {referenceNumber && <span className="ml-3">Reference: {referenceNumber}</span>}
          </div>
          <form action="/admin/preview/exit" method="post">
            <input type="hidden" name="returnTo" value={portalType === "customer" ? `/admin/customers/${targetId}` : `/admin/suppliers/${targetId}`} />
            <button className="rounded-lg border border-amber-950 px-3 py-2 font-bold hover:bg-amber-200">Exit Preview</button>
          </form>
        </div>
      </div>
      <DashboardShell
        title={`${portalType === "customer" ? "Customer workspace" : "Supplier portal"} · ${targetName}`}
        nav={nav.map(item => ({ label: item.label, href: item.section ? `${base}/${item.section}` : base }))}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
