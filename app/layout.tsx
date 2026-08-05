import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildMate Ghana",
  description: "Verified building materials, quotations, delivery and project procurement in one platform."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
