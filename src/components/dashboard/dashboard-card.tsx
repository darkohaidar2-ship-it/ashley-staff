
'use client';

import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardCardProps = {
  title: string;
  icon: LucideIcon;
  href: string;
  color: string;
};

export function DashboardCard({ title, icon: Icon, href, color }: DashboardCardProps) {
  return (
    <Link href={href} className="group block" passHref>
      <Card className="h-32 flex flex-col items-center justify-center text-center p-3 transition-transform transform hover:-translate-y-1 hover:shadow-xl border-none shadow-sm">
        <div className={cn('p-2.5 rounded-full text-white mb-2.5', color)}>
          <Icon className="w-6 h-6" />
        </div>
        <CardTitle className="text-sm font-bold leading-tight px-2">{title}</CardTitle>
      </Card>
    </Link>
  );
}
