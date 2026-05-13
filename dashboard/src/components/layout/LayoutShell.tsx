'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <Sidebar />
      <div className="flex-1 ml-[288px] flex flex-col min-h-screen relative">
        <Header />
        <main className="flex-1 p-6 lg:p-8 pt-4">
          <div className="max-w-[1440px] mx-auto">{children}</div>
        </main>
      </div>
    </>
  );
}
