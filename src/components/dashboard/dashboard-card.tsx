
'use client';

import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type DashboardCardProps = {
  title: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  color: string;
};

export function DashboardCard({ title, icon: Icon, href, onClick, color }: DashboardCardProps) {
  const content = (
    <Card className="h-32 flex flex-col items-center justify-center text-center p-3 transition-transform transform hover:-translate-y-1 hover:shadow-xl border-none shadow-sm cursor-pointer">
      <div className={cn('p-2.5 rounded-full text-white mb-2.5', color)}>
        <Icon className="w-6 h-6" />
      </div>
      <CardTitle className="text-sm font-bold leading-tight px-2">{title}</CardTitle>
    </Card>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="group block w-full text-left">
        {content}
      </button>
    );
  }

  return (
    <Link href={href || '#'} className="group block" passHref>
      {content}
    </Link>
  );
}
