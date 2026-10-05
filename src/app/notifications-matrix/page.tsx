import React from 'react';
import { Metadata } from 'next';
import NotificationRoutingMatrix from '@/components/admin/NotificationRoutingMatrix';

export const metadata: Metadata = {
  title: 'بەڕێوەبردنی ئاگادارییەکان و دەسەڵاتەکان | Ashley ERP',
  description: 'ڕێکخستنی ئەرک و ئاگادارییەکانی تەلەگرام بۆت و سیستەمی دەوامی ئاشڵی',
};

export default function NotificationsMatrixPage() {
  return (
    <main className="min-h-screen bg-slate-50/50 dark:bg-[#121214] py-6 px-3 sm:px-6">
      <NotificationRoutingMatrix />
    </main>
  );
}
