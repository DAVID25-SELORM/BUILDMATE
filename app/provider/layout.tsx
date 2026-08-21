import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { requireUser } from "@/lib/auth/session";

const nav = [
  { label: "Overview", href: "/provider" },
  { label: "Service requests", href: "/provider/requests" },
  { label: "Availability", href: "/provider/availability" },
  { label: "Profile & services", href: "/provider/profile" },
  { label: "Reviews", href: "/provider/reviews" },
  { label: "Support", href: "/support" },
];

export default async function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <DashboardShell title="Service provider portal" nav={nav}>
      {children}
    </DashboardShell>
  );
}
