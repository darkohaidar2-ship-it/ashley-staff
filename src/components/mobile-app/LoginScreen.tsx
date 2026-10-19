'use client';

import React, { useState } from 'react';
import { ShieldCheck, Sparkles, Mail, Lock, ArrowRight, Loader2, AlertCircle, Building2 } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { MobileAuthUser } from './types';
import { ASHLEY_OFFICIAL_EMPLOYEES } from '@/lib/ashley-employees';

interface LoginScreenProps {
  onLoginSuccess: (user: MobileAuthUser) => void;
  onNeedsBinding: (googleProfile: { email: string; displayName?: string; photoUrl?: string; uid?: string }) => void;
}

export function LoginScreen({ onLoginSuccess, onNeedsBinding }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual fallback state
  const [showManualEmail, setShowManualEmail] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualPin, setManualPin] = useState('');

  // 1. Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      let userCred;
      try {
        userCred = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        // Fallback for strict mobile webviews
        if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/popup-closed-by-user') {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }

      const googleUser = userCred.user;
      if (!googleUser?.email) {
        throw new Error('ئیمەیڵی گووگڵ نەدۆزرایەوە لە پرۆسەی چوونەژوورەوەدا');
      }

      const email = googleUser.email.trim().toLowerCase();

      // Check if this email is already bound to an Ashley staff member
      const checkRes = await fetch(`/api/auth/google-binding?email=${encodeURIComponent(email)}`);
      const checkData = await checkRes.json();

      if (checkData.success && checkData.bound && checkData.binding && checkData.employee) {
        const boundUser: MobileAuthUser = {
          email,
          employeeId: checkData.binding.employeeId,
          employeeName: checkData.employee.fullName3Part || checkData.employee.name,
          role: checkData.employee.role || 'Employee',
          photoUrl: checkData.binding.photoUrl || googleUser.photoURL || checkData.employee.photoUrl || undefined,
          googleUid: googleUser.uid,
          phone: checkData.employee.phone,
          loginTime: new Date().toISOString(),
          isFounder: Boolean(
            checkData.binding.employeeId === 'emp-02' || 
            checkData.employee.name?.includes('دارکۆ')
          ),
        };

        // Persist session
        localStorage.setItem('ashley_mobile_auth', JSON.stringify(boundUser));
        onLoginSuccess(boundUser);
      } else {
        // First-time user: needs account binding
        onNeedsBinding({
          email,
          displayName: googleUser.displayName || undefined,
          photoUrl: googleUser.photoURL || undefined,
          uid: googleUser.uid,
        });
      }
    } catch (err: any) {
      console.error('[LoginScreen] Google Auth Error:', err);
      setErrorMsg(err.message || 'هەڵەیەک ڕوویدا لە پەیوەندیکردن بە گووگڵەوە');
    } finally {
      setLoading(false);
    }
  };

  // 2. Direct Email Verification Handler (Fallback)
  const handleManualEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim()) {
      setErrorMsg('تکایە ئیمەیڵی گووگڵ بنووسە');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const email = manualEmail.trim().toLowerCase();
      const checkRes = await fetch(`/api/auth/google-binding?email=${encodeURIComponent(email)}`);
      const checkData = await checkRes.json();

      if (checkData.success && checkData.bound && checkData.binding && checkData.employee) {
        const boundUser: MobileAuthUser = {
          email,
          employeeId: checkData.binding.employeeId,
          employeeName: checkData.employee.fullName3Part || checkData.employee.name,
          role: checkData.employee.role || 'Employee',
          photoUrl: checkData.binding.photoUrl || checkData.employee.photoUrl || undefined,
          phone: checkData.employee.phone,
          loginTime: new Date().toISOString(),
          isFounder: Boolean(
            checkData.binding.employeeId === 'emp-02' || 
            checkData.employee.name?.includes('دارکۆ')
          ),
        };
        localStorage.setItem('ashley_mobile_auth', JSON.stringify(boundUser));
        onLoginSuccess(boundUser);
      } else {
        onNeedsBinding({
          email,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'هەڵە لە پشکنینی ئیمەیڵدا ڕوویدا');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6 dir-rtl font-sans select-none" dir="rtl">
      {/* Top Branding Section */}
      <div className="pt-10 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-3xl p-1 shadow-2xl shadow-amber-500/20 mb-5 flex items-center justify-center">
          <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
            <Building2 className="w-10 h-10 text-amber-400" />
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          سیستەمی فەرمی کارمەندان
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
          ئاشڵی هۆم ستۆر
        </h1>
        <p className="text-sm text-slate-400 max-w-xs">
          تۆمارکردنی زیرەکی کاتی دەوام، مەسروفات، و مۆڵەتەکانی ستاف
        </p>
      </div>

      {/* Main Login Card */}
      <div className="my-auto py-6">
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 shadow-xl">
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!showManualEmail ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 text-center leading-relaxed">
                تکایە بە هەژماری گووگڵ (Gmail) بچۆ ژوورەوە تاوەکو سیستەم بتناسێتەوە و دەوامت بۆ ڕێکبخات:
              </p>

              {/* Official Google Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-14 bg-white hover:bg-slate-100 active:scale-[0.98] transition-all duration-200 text-slate-900 rounded-2xl font-semibold flex items-center justify-center gap-3 shadow-lg shadow-white/5 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>داخڵبوون لە ڕێگەی گووگڵەوە</span>
                  </>
                )}
              </button>

              <div className="pt-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setShowManualEmail(true)}
                  className="text-xs text-slate-400 hover:text-amber-400 transition-colors underline decoration-slate-600 underline-offset-4"
                >
                  نوسینی ئیمەیڵ بە دەست
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleManualEmailCheck} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1.5">
                  ئیمەیڵی گووگڵ (Gmail):
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 absolute right-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    dir="ltr"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full h-12 bg-slate-900/80 border border-slate-700 text-white rounded-xl pr-11 pl-4 text-sm font-sans focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-12 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>بەردەوامبوون</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setShowManualEmail(false)}
                  className="px-4 h-12 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all"
                >
                  گەڕانەوە
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer Security Badges */}
      <div className="pb-4 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>پارێزراوە بە تەکنەلۆژیای ناوخۆیی ئاشڵی ٢٠٢٧</span>
        </div>
      </div>
    </div>
  );
}
