import type { Metadata } from "next";
import "./globals.css";
import { PresenceTracker } from "@/components/presence/PresenceTracker";

export const metadata: Metadata = {
  title: "BuildMate Ghana",
  description: "Verified building materials, quotations, delivery and project procurement in one platform."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}<PresenceTracker /></body></html>;
}
