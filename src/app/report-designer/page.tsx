
"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/use-translation';

export default function ReportDesignerRedirect() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    // This page is no longer used. The functionality has been merged into /settings under the "PDF & Reports" tab.
    // We redirect users to the correct settings tab.
    router.replace(`/settings?tab=pdf`);
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <p>{t('redirecting')}...</p>
    </div>
  );
}
