import React from 'react';
import { Metadata } from 'next';
import NotificationRoutingMatrix from '@/components/admin/NotificationRoutingMatrix';

export const metadata: Metadata = {
  title: 'بەڕێوەبردنی ئاگادارییەکان و دەسەڵاتەکان | Ashley ERP',
  description: 'ڕێکخستنی ئەرک و ئاگادارییەکانی تەلەگرام بۆت و سیستەمی دەوامی ئاشڵی',
};

export default function NotificationsMatrixPage() {
  return (
    <main className="h-screen w-full bg-[#f8fafc] p-2 sm:p-3 overflow-hidden flex flex-col">
      <NotificationRoutingMatrix />
    </main>
  );
}
