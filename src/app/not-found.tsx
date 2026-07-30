'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/hooks/use-auth';

export default function NotFound() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <ShieldAlert className="mb-8 h-24 w-24 text-destructive" />
      <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
        {t('page_not_found')}
      </h1>
      
      <div className="mt-10 flex items-center justify-center gap-x-6">
        <Button asChild>
          <Link href={user ? "/" : "/login"}>
            {t('back_to_dashboard')}
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/settings">
            {t('contact_support')} <span aria-hidden="true">&rarr;</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
