'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <React.Suspense fallback={<header className="fixed top-0 z-30 h-16 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md lg:pl-64" />}>
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
      </React.Suspense>
      <main className="pt-16 lg:pl-64">
        <div className="mx-auto max-w-screen-2xl p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
