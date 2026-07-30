import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole(["admin", "super_admin"]);
  return <>{children}</>;
}
