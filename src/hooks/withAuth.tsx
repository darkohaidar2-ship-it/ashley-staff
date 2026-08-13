import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, ShieldAlert } from 'lucide-react';

export default function withAuth<P extends object>(WrappedComponent: React.ComponentType<P>) {
  const WithAuthComponent = (props: P) => {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [hasSession, setHasSession] = React.useState<boolean | null>(null);

    React.useEffect(() => {
      const stored = typeof window !== 'undefined' ? (sessionStorage.getItem('ashley_admin_session') || localStorage.getItem('ashley_admin_session')) : null;
      const isAuth = !!stored || !!user;
      setHasSession(isAuth);
      if (!loading && !user && !stored) {
        router.replace('/login');
      }
    }, [user, loading, router]);

    if (loading || hasSession === null) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 font-sans dir-rtl" dir="rtl">
          <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center space-y-4 max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-sm font-black tracking-wide">🔒 پشکنینی ئاسایشی ئەدمین (Security Verification 2026)</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">تکایە چاوەڕێ بکە... پشکنین بۆ مۆڵەت و ئاسایشی چوونە ژوورەوە دەکرێت</p>
          </div>
        </div>
      );
    }

    if (!user && !hasSession) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white p-6 font-sans dir-rtl" dir="rtl">
          <div className="bg-rose-950/40 backdrop-blur-xl border border-rose-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center space-y-4 max-w-sm">
            <div className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-rose-400">⚠️ دەستگەیشتن ڕەتکرایەوە (Access Denied)</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-bold">تۆ ڕێگەپێدراو نیت بۆ بینینی ئەم پەڕەیە. ڕاستەوخۆ دەگوازرێیتەوە بۆ پەڕەی چوونە ژوورەوە (Login)...</p>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };

  WithAuthComponent.displayName = `WithAuth(${(WrappedComponent.displayName || WrappedComponent.name || 'Component')})`;

  return WithAuthComponent;
}
