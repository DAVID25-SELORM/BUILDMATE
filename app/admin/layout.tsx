import type { ReactNode } from "react";
import { requirePlatformAccess } from "@/lib/auth/permissions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePlatformAccess();
  return <>{children}</>;
}
