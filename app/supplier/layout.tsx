import type { ReactNode } from "react";
import { requireSupplierPermission } from "@/lib/organisations/access";

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  await requireSupplierPermission("supplier.profile.view");
  return <>{children}</>;
}
