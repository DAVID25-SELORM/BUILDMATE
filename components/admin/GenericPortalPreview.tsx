import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  CustomerOrdersView,
  CustomerQuotesView,
  SupplierOrdersView,
  SupplierProductsView,
  SupplierQuotesView,
  SupplierSettlementsView,
} from "@/components/dashboard/PortalSectionViews";
import { SupplierOverview } from "@/components/dashboard/SupplierOverview";
import { SupplierPortalShell } from "@/components/supplier/SupplierPortalShell";
import { requireRole } from "@/lib/auth/session";
import { customerCoreNavigation } from "@/lib/organisations/navigation";

export type GenericPortalType = "customer" | "supplier" | "driver" | "provider";
const providerNav = [
  "Overview",
  "Service requests",
  "Jobs",
  "Availability",
  "Profile",
  "Reviews",
  "Support",
];
const driverNav = [
  "Overview",
  "Available jobs",
  "Assigned deliveries",
  "Current delivery",
  "Completed deliveries",
  "Availability",
  "Vehicle",
  "Profile / Settings",
  "Support",
];
const slug = (label: string) =>
  label.toLowerCase().replaceAll(" / ", "-").replaceAll(" ", "-");

function PreviewBanner({ type }: { type: GenericPortalType }) {
  const label =
    type === "provider"
      ? "Service Provider"
      : `${type[0].toUpperCase()}${type.slice(1)}`;
  const supportTarget =
    type === "supplier"
      ? "/admin/suppliers"
      : type === "customer"
        ? "/admin/customers"
        : type === "provider"
          ? "/admin/service-providers"
          : "/admin/deliveries";
  return (
    <div className="mb-6 rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-black uppercase tracking-wide">
            Preview mode — {label} Portal
          </p>
          <p className="mt-1">
            You are viewing a generic read-only portal. No real customer,
            supplier, provider, order, payment, delivery, private file, or
            inventory data is loaded.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary bg-white" href={supportTarget}>
            Open Support View
          </Link>
          <Link className="btn-primary" href="/admin">
            Return to Admin
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyPage({
  title,
  description,
  implemented = true,
}: {
  title: string;
  description: string;
  implemented?: boolean;
}) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">{title}</h1>
          <p className="mt-2 text-slate-600">{description}</p>
        </div>
        <button className="btn-secondary" disabled>
          Preview only
        </button>
      </div>
      <div className="card mt-6 p-10 text-center">
        <p className="font-semibold text-slate-600">
          {implemented
            ? `No preview ${title.toLowerCase()}.`
            : "Not implemented yet"}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Generic preview data is kept in application code and is never
          persisted.
        </p>
      </div>
    </>
  );
}

function CustomerContent({ section }: { section: string }) {
  if (section === "orders") return <CustomerOrdersView orders={[]} readOnly />;
  if (section === "quotations")
    return <CustomerQuotesView requests={[]} readOnly />;
  if (section === "projects")
    return (
      <EmptyPage
        title="Projects"
        description="Plan project requirements and assisted procurement."
      />
    );
  if (section === "shop" || section === "categories")
    return (
      <EmptyPage
        title={section === "shop" ? "Shop" : "Categories"}
        description="Browse the materials marketplace without loading private customer activity."
      />
    );
  if (section === "services")
    return (
      <EmptyPage
        title="Services"
        description="Discover verified professionals and compare service profiles."
      />
    );
  if (section === "account")
    return (
      <EmptyPage
        title="Account"
        description="Manage personal details, preferences and security."
      />
    );
  if (section === "support")
    return (
      <EmptyPage
        title="Support"
        description="Support submission is disabled in generic preview mode."
      />
    );
  return (
    <>
      <h1 className="text-3xl font-black">Customer Home</h1>
      <p className="mt-2 text-slate-600">
        The real customer workspace shell with safe empty activity.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ["Open orders", "0"],
          ["Saved suppliers", "0"],
          ["Service requests", "0"],
        ].map(([label, value]) => (
          <div className="card p-5" key={label}>
            <p className="text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <section className="card mt-6 p-6">
        <h2 className="text-xl font-bold">Customer activity</h2>
        <p className="mt-3 text-sm text-slate-500">
          No preview orders, projects, quotations, or service requests.
        </p>
      </section>
    </>
  );
}

function SupplierContent({ section, base }: { section: string; base: string }) {
  if (section === "orders") return <SupplierOrdersView orders={[]} readOnly />;
  if (["quotations", "quotes"].includes(section))
    return <SupplierQuotesView requests={[]} readOnly />;
  if (section === "products")
    return <SupplierProductsView listings={[]} readOnly />;
  if (section === "settlements")
    return <SupplierSettlementsView entries={[]} balance={0} />;
  if (section === "inventory")
    return (
      <EmptyPage
        title="Inventory"
        description="Track branch-level stock, valuation, counts and movements."
      />
    );
  if (section === "inventory/reports")
    return (
      <EmptyPage
        title="Inventory reports"
        description="Review stock movement, valuation and replenishment reports."
      />
    );
  if (section === "staff")
    return (
      <EmptyPage
        title="Staff"
        description="Manage supplier roles, permissions and branch assignments."
      />
    );
  if (section === "settings")
    return (
      <EmptyPage
        title="Organisation settings"
        description="Manage branches, organisation details and data rights."
      />
    );
  return (
    <SupplierOverview
      orders={[]}
      activeListings={0}
      quoteStatuses={[]}
      financials={{
        sales: 0,
        cost_value: null,
        retail_value: 0,
        realised_gross_margin: null,
        low_stock: 0,
        reserved_stock: 0,
        returns_pending: 0,
      }}
      organisationName="Preview Supplier"
      previewBase={base}
    />
  );
}

function OperationalContent({
  type,
  section,
}: {
  type: "driver" | "provider";
  section: string;
}) {
  const title = section
    ? section
        .replaceAll("-", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Overview";
  const implemented =
    type === "provider"
      ? [
          "",
          "service-requests",
          "availability",
          "profile",
          "reviews",
          "support",
        ].includes(section)
      : ["", "assigned-deliveries", "support"].includes(section);
  if (!section)
    return (
      <>
        <h1 className="text-3xl font-black">
          {type === "provider"
            ? "Service provider overview"
            : "Driver overview"}
        </h1>
        <p className="mt-2 text-slate-600">
          A structural preview with no live jobs, requests, deliveries,
          vehicles, or location data.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            [type === "provider" ? "New requests" : "Assigned deliveries", "0"],
            ["Jobs in progress", "0"],
            [type === "provider" ? "Reviews" : "Completed today", "0"],
          ].map(([label, value]) => (
            <div className="card p-5" key={label}>
              <p className="text-sm text-slate-600">{label}</p>
              <p className="mt-2 text-3xl font-black">{value}</p>
            </div>
          ))}
        </div>
      </>
    );
  return (
    <EmptyPage
      title={title}
      description={`Safe ${type} portal structure with no private operational data.`}
      implemented={implemented}
    />
  );
}

export async function GenericPortalPreview({
  type,
  sections = [],
}: {
  type: GenericPortalType;
  sections?: string[];
}) {
  await requireRole(["admin", "super_admin"]);
  const base = `/admin/preview/${type}`;
  const section = sections.join("/");
  if (type === "supplier")
    return (
      <SupplierPortalShell
        organisationName="Preview Supplier — no real organisation"
        previewBase={base}
      >
        <PreviewBanner type={type} />
        <SupplierContent section={section} base={base} />
      </SupplierPortalShell>
    );
  const labels =
    type === "customer"
      ? customerCoreNavigation.map((item) => item.label)
      : type === "provider"
        ? providerNav
        : driverNav;
  const nav = labels.map((label) => ({
    label,
    href:
      label === "Home" || label === "Overview"
        ? base
        : `${base}/${slug(label)}`,
  }));
  return (
    <DashboardShell
      title={`${type === "provider" ? "Service provider" : type[0].toUpperCase() + type.slice(1)} portal preview`}
      nav={nav}
    >
      <PreviewBanner type={type} />
      {type === "customer" ? (
        <CustomerContent section={section} />
      ) : (
        <OperationalContent type={type} section={section} />
      )}
    </DashboardShell>
  );
}
