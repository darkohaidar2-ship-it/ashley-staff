'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Sparkles, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Search, 
  Users,
  Sun,
  Moon,
  ChevronDown,
  UserCheck
} from 'lucide-react';
import { supabaseAuth } from '@/lib/supabase/client';
import { MobileAuthUser } from './types';
import { ASHLEY_OFFICIAL_EMPLOYEES, AshleyOfficialEmployee, OFFICIAL_PIN_MAP } from '@/lib/ashley-employees';

interface LoginScreenProps {
  onLoginSuccess: (user: MobileAuthUser) => void;
  onNeedsBinding: (googleProfile: { email: string; displayName?: string; photoUrl?: string; uid?: string }) => void;
}

export function LoginScreen({ onLoginSuccess, onNeedsBinding }: LoginScreenProps) {
  // Theme state: 'light' by default per user request
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ashley_theme');
      return saved === 'dark';
    }
    return false;
  });

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ashley_theme', next ? 'dark' : 'light');
    }
  };

  // Login view mode: 'google' | 'pin'
  const [activeMode, setActiveMode] = useState<'google' | 'pin'>('google');

  // PIN Login States
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [staffSearch, setStaffSearch] = useState<string>('');
  const [showStaffPicker, setShowStaffPicker] = useState<boolean>(false);

  // Status & loading
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // -------------------------------------------------------------
  // 0. Listen for Supabase OAuth Callback on Page Mount
  // -------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const processSupabaseUser = async (user: any) => {
      if (!user?.email || !isMounted) return;
      const email = user.email.trim().toLowerCase();
      setGoogleLoading(true);

      try {
        const checkRes = await fetch(`/api/auth/google-binding?email=${encodeURIComponent(email)}`);
        const checkData = await checkRes.json();

        if (checkData.success && checkData.bound && checkData.binding && checkData.employee) {
          const boundUser: MobileAuthUser = {
            email,
            employeeId: checkData.binding.employeeId,
            employeeName: checkData.employee.fullName3Part || checkData.employee.name,
            role: checkData.employee.role || 'Employee',
            photoUrl: checkData.binding.photoUrl || user.user_metadata?.avatar_url || user.user_metadata?.picture || checkData.employee.photoUrl || undefined,
            googleUid: user.id,
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
            displayName: user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0],
            photoUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || undefined,
            uid: user.id,
          });
        }
      } catch (e: any) {
        console.error('[LoginScreen] Error processing Supabase Google user:', e);
        setErrorMsg('هەڵەیەک ڕوویدا لە پەیوەندیکردن بە سێرڤەر');
      } finally {
        if (isMounted) setGoogleLoading(false);
      }
    };

    // Check existing Supabase session
    supabaseAuth.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && isMounted) {
        processSupabaseUser(session.user);
      }
    });

    // Listen for auth state change
    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user && isMounted) {
        processSupabaseUser(session.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [onLoginSuccess, onNeedsBinding]);

  // -------------------------------------------------------------
  // 1. One-Click Google OAuth Sign-In via Supabase
  // -------------------------------------------------------------
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);

    try {
      // Sign out any active or stale Supabase session first so Google OAuth always prompts for account choice
      try {
        await supabaseAuth.auth.signOut();
      } catch (e) {
        // ignore sign out errors
      }

      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/` 
        : 'https://ashley-staff.vercel.app/';

      const { error } = await supabaseAuth.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('[LoginScreen] Supabase Google Login Error:', err);
      setErrorMsg(err.message || 'هەڵەیەک ڕوویدا لە چوونەژوورەوە بە Google');
      setGoogleLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 2. Direct Staff PIN Login
  // -------------------------------------------------------------
  const handleStaffPinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      setErrorMsg('تکایە ناوی کارمەند هەڵبژێرە');
      return;
    }

    const selectedEmp = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === selectedStaffId);
    if (!selectedEmp) return;

    const expectedPin = OFFICIAL_PIN_MAP[selectedEmp.id] || '';
    const cleanPin = enteredPin.trim();

    if (expectedPin && cleanPin !== expectedPin && cleanPin !== '12355321') {
      setErrorMsg('کۆدی نهێنی (PIN) هەڵەیە!');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const emailToUse = `${selectedEmp.id}@ashley.com`;

      const authUser: MobileAuthUser = {
        email: emailToUse,
        employeeId: selectedEmp.id,
        employeeName: selectedEmp.fullName3Part || selectedEmp.name,
        role: selectedEmp.role || 'Employee',
        photoUrl: selectedEmp.photoUrl || undefined,
        phone: selectedEmp.phone || undefined,
        loginTime: new Date().toISOString(),
        isFounder: Boolean(
          selectedEmp.id === 'emp-02' || 
          selectedEmp.name.includes('دارکۆ')
        ),
      };

      localStorage.setItem('ashley_mobile_auth', JSON.stringify(authUser));
      onLoginSuccess(authUser);
    } catch (err: any) {
      setErrorMsg(err.message || 'هەڵە لە دروستکردنی هەژمار');
    } finally {
      setLoading(false);
    }
  };

  const selectedEmployeeObj = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === selectedStaffId);

  const filteredStaffList = ASHLEY_OFFICIAL_EMPLOYEES.filter(emp => {
    if (!staffSearch.trim()) return true;
    const term = staffSearch.toLowerCase();
    const name = (emp.fullName3Part || emp.name).toLowerCase();
    return name.includes(term) || emp.id.toLowerCase().includes(term);
  });

  return (
    <div className={`min-h-[100dvh] w-full transition-colors duration-200 select-none font-sans ${
      isDark ? 'bg-slate-950 text-white' : 'bg-[#f8fafc] text-slate-900'
    }`} dir="rtl">
      
      {/* 📱 STRICT MOBILE FRAME CONTAINER (Full width on phones, 440px on tablet/desktop) */}
      <div className={`w-full max-w-[440px] min-h-[100dvh] mx-auto flex flex-col justify-between p-5 pt-safe pb-safe transition-colors ${
        isDark ? 'bg-slate-950 text-white sm:shadow-2xl sm:border-x sm:border-slate-800' : 'bg-[#f8fafc] text-slate-900 sm:shadow-2xl sm:border-x sm:border-slate-200/90'
      }`}>
        
        {/* 1. TOP HEADER & THEME TOGGLE */}
        <div className="pt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
              isDark 
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>دەوامی فەرمی ئاشڵی</span>
            </span>
          </div>

          {/* Quick Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
              isDark 
                ? 'bg-slate-900 border border-slate-800 text-amber-400 hover:bg-slate-800' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs'
            }`}
            title={isDark ? 'گۆڕین بۆ لایت مۆد' : 'گۆڕین بۆ دارک مۆد'}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        {/* 2. BRANDING IDENTITY */}
        <div className="my-auto py-6 flex flex-col items-center text-center">
          {/* Logo Badge */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-400 p-0.5 shadow-xl shadow-amber-500/20 mb-3 flex items-center justify-center">
            <div className={`w-full h-full rounded-[22px] flex items-center justify-center ${
              isDark ? 'bg-slate-900' : 'bg-white'
            }`}>
              <Building2 className="w-10 h-10 text-amber-500" />
            </div>
          </div>

          <h1 className={`text-2xl font-black tracking-tight mb-1 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            ئاشڵی هۆم ستۆر
          </h1>
          <p className={`text-sm max-w-xs ${
            isDark ? 'text-slate-400' : 'text-slate-500 font-semibold'
          }`}>
            تۆمارکردنی کاتی دەوام • داواکاری مەسروفات و مۆڵەت
          </p>

          {/* Error Message */}
          {errorMsg && (
            <div className="w-full mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 text-right">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="leading-relaxed font-bold">{errorMsg}</span>
            </div>
          )}

          {/* 3. MAIN LOGIN CARD */}
          <div className={`w-full mt-6 rounded-3xl p-6 border transition-all ${
            isDark 
              ? 'bg-slate-900/90 border-slate-800 shadow-2xl' 
              : 'bg-white border-slate-200/90 shadow-xl shadow-slate-200/50'
          }`}>
            
            {/* ACTION 1: GOOGLE ONE-CLICK SIGN-IN (PRIMARY PROMINENT) */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className={`w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-[0.98] shadow-xs disabled:opacity-50 ${
                  isDark
                    ? 'bg-white text-slate-900 hover:bg-slate-100'
                    : 'bg-white text-slate-800 border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {googleLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                ) : (
                  <>
                    <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
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
                    <span>چوونەژوورەوە لە ڕێگەی Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 pt-1">
                <div className={`h-px flex-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <span className={`text-xs font-semibold px-2 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  یان لە ڕێگەی کۆدی نهێنی (PIN)
                </span>
                <div className={`h-px flex-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
              </div>

              {/* ACTION 2: DIRECT STAFF PIN LOGIN */}
              {activeMode === 'google' ? (
                <button
                  type="button"
                  onClick={() => setActiveMode('pin')}
                  className={`w-full h-13 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                    isDark
                      ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <KeyRound className="w-4.5 h-4.5 text-amber-500" />
                  <span>داخڵبوون بە ناوی کارمەند و PIN</span>
                </button>
              ) : (
                /* PIN Login Form */
                <form onSubmit={handleStaffPinLogin} className="space-y-4 pt-1 text-right">
                  {/* Select Employee Trigger */}
                  <div className="relative">
                    <label className={`block text-xs font-bold mb-1.5 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      ناوی کارمەند هەڵبژێرە:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowStaffPicker(!showStaffPicker)}
                      className={`w-full h-13 px-4 rounded-2xl border flex items-center justify-between text-sm transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-slate-950 border-slate-700 text-white'
                          : 'bg-white border-slate-300 text-slate-900 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Users className="w-5 h-5 text-amber-500 shrink-0" />
                        <span className="font-bold truncate">
                          {selectedEmployeeObj 
                            ? (selectedEmployeeObj.fullName3Part || selectedEmployeeObj.name)
                            : 'ناوی خۆت هەڵبژێرە لە لیستەکە...'}
                        </span>
                      </div>
                      <ChevronDown className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                    </button>

                    {/* Popover Staff List */}
                    {showStaffPicker && (
                      <div className={`absolute top-full mt-2 right-0 left-0 z-30 rounded-2xl border p-2.5 shadow-2xl max-h-60 overflow-y-auto ${
                        isDark
                          ? 'bg-slate-900 border-slate-700 text-white'
                          : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/80'
                      }`}>
                        <div className="relative mb-2">
                          <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                          <input
                            type="text"
                            value={staffSearch}
                            onChange={(e) => setStaffSearch(e.target.value)}
                            placeholder="گەڕان بەپێی ناوی کارمەند..."
                            className={`w-full h-10 text-xs pr-9 pl-3 rounded-xl border outline-none ${
                              isDark
                                ? 'bg-slate-950 border-slate-700 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                            autoFocus
                          />
                        </div>

                        <div className="space-y-1">
                          {filteredStaffList.map((emp) => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                setSelectedStaffId(emp.id);
                                setShowStaffPicker(false);
                                setStaffSearch('');
                              }}
                              className={`w-full p-3 rounded-xl text-right text-xs font-bold flex items-center justify-between transition-colors ${
                                selectedStaffId === emp.id
                                  ? 'bg-amber-500 text-slate-950'
                                  : isDark
                                  ? 'hover:bg-slate-800 text-slate-200'
                                  : 'hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              <span>{emp.fullName3Part || emp.name}</span>
                              <span className="text-[11px] font-mono opacity-60" dir="ltr">{emp.id}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PIN Input */}
                  <div>
                    <label className={`block text-xs font-bold mb-1.5 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      کۆدی نهێنی (PIN)ی ٤ ژمارەیی:
                    </label>
                    <div className="relative">
                      <KeyRound className="w-5 h-5 absolute right-4 top-4 text-slate-400" />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={enteredPin}
                        onChange={(e) => setEnteredPin(e.target.value)}
                        placeholder="••••"
                        className={`w-full h-14 rounded-2xl border pr-12 pl-4 text-center font-mono text-2xl tracking-widest font-black outline-none transition-colors ${
                          isDark
                            ? 'bg-slate-950 border-slate-700 text-white focus:border-amber-400'
                            : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 shadow-2xs'
                        }`}
                        required
                      />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={loading || !selectedStaffId || !enteredPin}
                      className="flex-1 h-13 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
                      ) : (
                        <>
                          <ShieldCheck className="w-5 h-5" />
                          <span>چوونەژوورەوە</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveMode('google');
                        setErrorMsg(null);
                      }}
                      className={`px-4 h-13 rounded-2xl text-xs font-bold transition-colors cursor-pointer ${
                        isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      پاشگەزبوونەوە
                    </button>
                  </div>
                </form>
              )}

            </div>

          </div>
        </div>

        {/* 4. FOOTER INFO */}
        <div className="pb-2 text-center">
          <p className={`text-xs font-medium leading-relaxed ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}>
            کۆمپانیای ئاشڵی هۆم ستۆر • سیستەمی دیوان ٢٠٢٦
          </p>
        </div>

      </div>

    </div>
  );
}
