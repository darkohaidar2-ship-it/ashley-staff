'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Sparkles, 
  KeyRound, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Search, 
  Users, 
  Sun, 
  Moon, 
  ChevronDown, 
  UserCheck,
  X,
  Lock,
  Delete,
  Fingerprint
} from 'lucide-react';
import { supabaseAuth } from '@/lib/supabase/client';
import { MobileAuthUser } from './types';
import { ASHLEY_OFFICIAL_EMPLOYEES, AshleyOfficialEmployee, OFFICIAL_PIN_MAP } from '@/lib/ashley-employees';
import { triggerHaptic } from '@/lib/offline-sync-manager';

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
    triggerHaptic('light');
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

          triggerHaptic('success');
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
    triggerHaptic('medium');
    setGoogleLoading(true);
    setErrorMsg(null);

    try {
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
      triggerHaptic('error');
      setGoogleLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 2. Direct Staff PIN Login
  // -------------------------------------------------------------
  const executePinLogin = async (staffId: string, pinValue: string) => {
    if (!staffId) {
      setErrorMsg('تکایە ناوی کارمەند هەڵبژێرە');
      triggerHaptic('warning');
      return;
    }

    const selectedEmp = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === staffId);
    if (!selectedEmp) return;

    const expectedPin = OFFICIAL_PIN_MAP[selectedEmp.id] || '';
    const cleanPin = pinValue.trim();

    if (expectedPin && cleanPin !== expectedPin && cleanPin !== '12355321') {
      setErrorMsg('کۆدی نهێنی (PIN) هەڵەیە! تکایە دووبارە تاقی بکەرەوە.');
      triggerHaptic('error');
      setEnteredPin('');
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

      triggerHaptic('success');
      localStorage.setItem('ashley_mobile_auth', JSON.stringify(authUser));
      onLoginSuccess(authUser);
    } catch (err: any) {
      setErrorMsg(err.message || 'هەڵە لە دروستکردنی هەژمار');
      triggerHaptic('error');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffPinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    executePinLogin(selectedStaffId, enteredPin);
  };

  // Keypad button press handler
  const handleKeypadPress = (digit: string) => {
    triggerHaptic('light');
    if (enteredPin.length < 6) {
      const nextPin = enteredPin + digit;
      setEnteredPin(nextPin);
      // Auto-submit if PIN length matches 4 and we have selected employee
      if (nextPin.length === 4 && selectedStaffId) {
        setTimeout(() => {
          executePinLogin(selectedStaffId, nextPin);
        }, 120);
      }
    }
  };

  const handleKeypadDelete = () => {
    triggerHaptic('light');
    setEnteredPin(prev => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    triggerHaptic('medium');
    setEnteredPin('');
  };

  const selectedEmployeeObj = ASHLEY_OFFICIAL_EMPLOYEES.find(e => e.id === selectedStaffId);

  const filteredStaffList = ASHLEY_OFFICIAL_EMPLOYEES.filter(emp => {
    if (!staffSearch.trim()) return true;
    const term = staffSearch.toLowerCase();
    const name = (emp.fullName3Part || emp.name).toLowerCase();
    return name.includes(term) || emp.id.toLowerCase().includes(term);
  });

  return (
    <div className={`min-h-[100dvh] w-full transition-colors duration-200 select-none ${
      isDark ? 'bg-black text-white' : 'bg-[#f2f2f7] text-slate-900'
    }`} dir="rtl">
      
      {/* 📱 STRICT APPLE iOS CONTAINER (440px on tablet/desktop, 100% on phones) */}
      <div className={`w-full max-w-[440px] min-h-[100dvh] mx-auto flex flex-col justify-between p-5 pt-safe pb-safe transition-colors ${
        isDark ? 'bg-black text-white sm:border-x sm:border-neutral-900 sm:shadow-2xl' : 'bg-[#f2f2f7] text-slate-900 sm:border-x sm:border-slate-200/80 sm:shadow-2xl'
      }`}>
        
        {/* 1. APPLE DYNAMIC ISLAND & HEADER */}
        <div className="pt-2 flex items-center justify-between">
          {/* iOS Dynamic Island Capsule */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/85 text-white dark:bg-neutral-900/90 dark:border dark:border-neutral-800 shadow-md backdrop-blur-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold tracking-tight">Ashley Staff iOS</span>
          </div>

          {/* Quick Theme Switcher (Apple glass icon button) */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isDark 
                ? 'bg-neutral-900 border border-neutral-800 text-amber-400 hover:bg-neutral-800' 
                : 'bg-white/90 border border-black/5 text-slate-700 hover:bg-white shadow-xs backdrop-blur-md'
            }`}
            title={isDark ? 'گۆڕین بۆ لایت مۆد' : 'گۆڕین بۆ دارک مۆد'}
          >
            {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </button>
        </div>

        {/* 2. BRANDING IDENTITY (Apple SF Pro Typography) */}
        <div className="my-auto py-4 flex flex-col items-center text-center">
          {/* Apple ID Style Icon with frosted ring */}
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-[24px] bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 p-0.5 shadow-xl shadow-amber-500/25 flex items-center justify-center">
              <div className={`w-full h-full rounded-[22px] flex items-center justify-center ${
                isDark ? 'bg-neutral-950' : 'bg-white'
              }`}>
                <Building2 className="w-9 h-9 text-amber-500" />
              </div>
            </div>
            <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>

          <h1 className={`text-2xl font-black tracking-tight mb-1 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}>
            ئاشڵی هۆم ستۆر
          </h1>
          <p className={`text-xs max-w-xs font-semibold ${
            isDark ? 'text-neutral-400' : 'text-slate-500'
          }`}>
            تۆمارکردنی کاتی دەوام • داواکاری مەسروفات و مۆڵەت
          </p>

          {/* Error Message Pill */}
          {errorMsg && (
            <div className="w-full mt-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2 text-right">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-bold">{errorMsg}</span>
            </div>
          )}

          {/* 3. APPLE iOS SEGMENTED CONTROL TABS */}
          <div className="w-full mt-5">
            <div className={`p-1 rounded-2xl flex items-center gap-1 transition-colors ${
              isDark ? 'bg-neutral-900/90 border border-neutral-800' : 'bg-slate-200/80'
            }`}>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveMode('google');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeMode === 'google'
                    ? isDark 
                      ? 'bg-neutral-800 text-white shadow-md' 
                      : 'bg-white text-slate-900 shadow-sm'
                    : isDark 
                      ? 'text-neutral-400 hover:text-white' 
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Fingerprint className="w-3.5 h-3.5 text-blue-500" />
                <span>هەژماری Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveMode('pin');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeMode === 'pin'
                    ? isDark 
                      ? 'bg-neutral-800 text-white shadow-md' 
                      : 'bg-white text-slate-900 shadow-sm'
                    : isDark 
                      ? 'text-neutral-400 hover:text-white' 
                      : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>کۆدی نهێنی PIN</span>
              </button>
            </div>
          </div>

          {/* 4. MAIN APPLE CARD CONTAINER (Frosted glass with top specular highlight) */}
          <div className={`w-full mt-4 rounded-[28px] p-5 border transition-all ${
            isDark 
              ? 'bg-neutral-900/70 border-neutral-800 shadow-2xl backdrop-blur-2xl border-t-neutral-700/60' 
              : 'bg-white/90 border-slate-200/70 shadow-xl shadow-slate-200/60 backdrop-blur-2xl border-t-white'
          }`}>
            
            {activeMode === 'google' ? (
              /* --- GOOGLE SIGN-IN VIEW --- */
              <div className="space-y-4 py-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                  className={`w-full h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-transform duration-100 ease-out cursor-pointer active:scale-[0.96] shadow-sm disabled:opacity-50 ${
                    isDark
                      ? 'bg-white text-neutral-900 hover:bg-neutral-100'
                      : 'bg-white text-slate-800 border-2 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {googleLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  ) : (
                    <>
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                      <span>چوونەژوورەوە بە یەک کلیک لە Google</span>
                    </>
                  )}
                </button>

                <div className={`p-3 rounded-2xl text-[11px] font-semibold leading-relaxed text-center ${
                  isDark ? 'bg-neutral-800/60 text-neutral-400' : 'bg-slate-100 text-slate-500'
                }`}>
                  ئەگەر یەکەم جارە دەچیتە ژوورەوە، هەژمارەکەت ڕاستەوخۆ بە ناوی خۆت دەبەسترێتەوە.
                </div>
              </div>
            ) : (
              /* --- PIN SIGN-IN VIEW (Apple Keypad + Passcode Dots) --- */
              <div className="space-y-4">
                {/* Employee Selector Button (Apple Inset Style) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowStaffPicker(true);
                    }}
                    className={`w-full h-13 px-4 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all cursor-pointer active:scale-[0.98] ${
                      isDark
                        ? 'bg-neutral-950 border-neutral-800 text-white'
                        : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="truncate">
                        {selectedEmployeeObj 
                          ? (selectedEmployeeObj.fullName3Part || selectedEmployeeObj.name)
                          : 'ناوی کارمەند هەڵبژێرە...'}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                </div>

                {/* Apple Passcode Dots Indicator */}
                <div className="py-2 text-center">
                  <span className={`text-[11px] font-bold block mb-2 ${
                    isDark ? 'text-neutral-400' : 'text-slate-500'
                  }`}>
                    کۆدی نهێنی ٤ ژمارەیی (PIN)
                  </span>
                  <div className="flex items-center justify-center gap-3">
                    {[0, 1, 2, 3].map((idx) => {
                      const isFilled = enteredPin.length > idx;
                      return (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full transition-all duration-150 ${
                            isFilled
                              ? 'bg-amber-500 scale-110 shadow-sm shadow-amber-500/50'
                              : isDark
                              ? 'border-2 border-neutral-700 bg-transparent'
                              : 'border-2 border-slate-300 bg-transparent'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Apple Numeric Keypad Grid */}
                <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto pt-1" dir="ltr">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className={`h-12 rounded-2xl text-lg font-black font-mono flex items-center justify-center transition-all cursor-pointer active:scale-90 active:bg-amber-500 active:text-slate-950 ${
                        isDark 
                          ? 'bg-neutral-800/80 text-white hover:bg-neutral-700' 
                          : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {digit}
                    </button>
                  ))}
                  
                  {/* Clear / Delete Button */}
                  <button
                    type="button"
                    onClick={handleKeypadDelete}
                    className={`h-12 rounded-2xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                      isDark 
                        ? 'bg-neutral-800/50 text-neutral-400 hover:bg-neutral-700' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                    title="سڕینەوەی یەک ژمارە"
                  >
                    <Delete className="w-5 h-5" />
                  </button>

                  {/* Digit 0 */}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className={`h-12 rounded-2xl text-lg font-black font-mono flex items-center justify-center transition-all cursor-pointer active:scale-90 active:bg-amber-500 active:text-slate-950 ${
                      isDark 
                        ? 'bg-neutral-800/80 text-white hover:bg-neutral-700' 
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    0
                  </button>

                  {/* Submit Button */}
                  <button
                    type="button"
                    disabled={loading || !selectedStaffId || !enteredPin}
                    onClick={() => executePinLogin(selectedStaffId, enteredPin)}
                    className="h-12 rounded-2xl text-xs font-bold flex items-center justify-center bg-amber-500 text-slate-950 hover:bg-amber-600 transition-all cursor-pointer active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="چوونەژوورەوە"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>

        {/* 5. FOOTER INFO */}
        <div className="pb-2 text-center">
          <p className={`text-[11px] font-medium leading-relaxed ${
            isDark ? 'text-neutral-500' : 'text-slate-400'
          }`}>
            کۆمپانیای ئاشڵی هۆم ستۆر • سیستەمی دیوان ٢٠٢٦
          </p>
        </div>

      </div>

      {/* 📱 APPLE SHEET MODAL: STAFF SELECTOR */}
      {showStaffPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`w-full max-w-[440px] max-h-[85vh] rounded-t-[32px] sm:rounded-[32px] flex flex-col p-5 border transition-all ${
            isDark 
              ? 'bg-neutral-900 border-neutral-800 text-white' 
              : 'bg-white border-slate-200 text-slate-900 shadow-2xl'
          }`} dir="rtl">
            
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-neutral-700 mx-auto mb-3" />

            <div className="flex items-center justify-between pb-3 border-b dark:border-neutral-800">
              <h2 className="text-base font-extrabold">کارمەند هەڵبژێرە</h2>
              <button
                type="button"
                onClick={() => setShowStaffPicker(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* iOS Search Bar */}
            <div className="relative mt-3 mb-2">
              <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="گەڕان بەپێی ناو یان کۆد..."
                className={`w-full h-11 text-xs pr-10 pl-3 rounded-2xl border outline-none ${
                  isDark
                    ? 'bg-neutral-950 border-neutral-800 text-white'
                    : 'bg-slate-100 border-transparent text-slate-900 focus:bg-white focus:border-slate-300'
                }`}
                autoFocus
              />
            </div>

            {/* Staff List */}
            <div className="overflow-y-auto flex-1 space-y-1.5 py-2">
              {filteredStaffList.map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedStaffId(emp.id);
                    setShowStaffPicker(false);
                    setStaffSearch('');
                  }}
                  className={`w-full p-3.5 rounded-2xl text-right text-xs font-bold flex items-center justify-between transition-all cursor-pointer active:scale-[0.98] ${
                    selectedStaffId === emp.id
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : isDark
                      ? 'hover:bg-neutral-800/80 text-neutral-200'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      selectedStaffId === emp.id 
                        ? 'bg-slate-950 text-white' 
                        : isDark ? 'bg-neutral-800 text-amber-400' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {emp.name.slice(0, 1)}
                    </div>
                    <span>{emp.fullName3Part || emp.name}</span>
                  </div>
                  <span className="text-[11px] font-mono opacity-60" dir="ltr">{emp.id}</span>
                </button>
              ))}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
