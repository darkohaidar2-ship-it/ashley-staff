'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FeedbackPortal } from '@/components/feedback/FeedbackPortal';
import { Loader2 } from 'lucide-react';

function FeedbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pin = searchParams.get('pin') || '';

  return (
    <FeedbackPortal
      initialPin={pin}
      onBackToAttendance={() => router.push('/')}
    />
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f2f2f7]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    }>
      <FeedbackContent />
    </Suspense>
  );
}
