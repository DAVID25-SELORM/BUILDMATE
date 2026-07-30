import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/session";

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  await requireRole(["supplier"]);
  return <>{children}</>;
}
