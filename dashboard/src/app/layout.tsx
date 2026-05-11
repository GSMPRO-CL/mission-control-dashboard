import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LayoutShell } from "@/components/layout/LayoutShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GSM PRO - Dashboard de KPIs",
  description: "Dashboard avanzado de E-commerce in-house",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${inter.className} antialiased min-h-screen flex selection:bg-blue-500/30 selection:text-blue-200`}>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
