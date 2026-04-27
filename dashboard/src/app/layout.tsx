import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

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
    <html lang="es" className="dark">
      <body className={`${inter.className} antialiased min-h-screen flex selection:bg-blue-500/30 selection:text-blue-200`}>
        <Sidebar />
        <div className="flex-1 ml-64 flex flex-col min-h-screen relative">
          <Header />
          <main className="flex-1 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
