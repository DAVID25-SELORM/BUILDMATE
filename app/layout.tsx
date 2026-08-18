import type { Metadata } from "next";
import "./globals.css";
import { PresenceTracker } from "@/components/presence/PresenceTracker";
import { SupportCentre } from "@/components/support/SupportCentre";

export const metadata: Metadata = {
  title: "BuildMate Ghana",
  description: "Verified building materials, quotations, delivery and project procurement in one platform."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}<PresenceTracker /><SupportCentre /></body></html>;
}
