'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 🚫 BLOCKED: Access to /admin is permanently blocked per user policy.
// The sole authorized gateway is /adm1n_pan0l.
export default function BlockedAdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
