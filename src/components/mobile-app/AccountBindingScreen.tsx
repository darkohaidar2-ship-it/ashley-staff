'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserCheck, 
  Search, 
  Lock, 
  KeyRound, 
  ShieldCheck, 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Sparkles,
  LogOut,
  Mail
} from 'lucide-react';
import { ASHLEY_OFFICIAL_EMPLOYEES, AshleyOfficialEmployee } from '@/lib/ashley-employees';
import { supabaseAuth } from '@/lib/supabase/client';
import { MobileAuthUser } from './types';

interface AccountBindingScreenProps {
  googleProfile: {
    email: string;
    displayName?: string;
    photoUrl?: string;
    uid?: string;
  };
  onBindingSuccess: (user: MobileAuthUser) => void;
  onCancel: () => void;
}

export function AccountBindingScreen({
  googleProfile,
  onBindingSuccess,
  onCancel,
}: AccountBindingScreenProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [boundEmployeeMap, setBoundEmployeeMap] = useState<Record<string, string>>({});
  const [loadingBindings, setLoadingBindings] = useState(true);

  // Selected Employee for PIN verification modal
  const [selectedEmp, setSelectedEmp] = useState<AshleyOfficialEmployee | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Explicitly sign out from Supabase and cancel binding
  const handleSwitchAccount = async () => {
    try {
      await supabaseAuth.auth.signOut();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    try {
      localStorage.removeItem('ashley_mobile_auth');
    } catch (e) {}
    onCancel();
  };

  // Fetch already bound employees
  useEffect(() => {
    let isMounted = true;
    async function loadBindings() {
      try {
        const res = await fetch('/api/auth/google-binding');
        const data = await res.json();
        if (isMounted && data.success && data.boundEmployeeMap) {
          setBoundEmployeeMap(data.boundEmployeeMap);
        }
      } catch (err) {
        console.error('[AccountBindingScreen] Error loading bindings:', err);
      } finally {
        if (isMounted) setLoadingBindings(false);
      }
    }
    loadBindings();
    return () => { isMounted = false; };
  }, []);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return ASHLEY_OFFICIAL_EMPLOYEES.filter(emp => {
      if (!term) return true;
      const name = (emp.fullName3Part || emp.name).toLowerCase();
      const code = (emp.id || '').toLowerCase();
      return name.includes(term) || code.includes(term);
    });
  }, [searchTerm]);

  // Is selected employee bound to another email?
  const isSelectedEmpBoundToAnother = useMemo(() => {
    if (!selectedEmp) return false;
    const boundEmail = boundEmployeeMap[selectedEmp.id];
    return Boolean(boundEmail && boundEmail.toLowerCase() !== googleProfile.email.toLowerCase());
  }, [selectedEmp, boundEmployeeMap, googleProfile.email]);

  // Submit Binding with PIN
  const handleConfirmBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    if (!pinInput.trim()) {
      setPinError('تکایە کۆدی نهێنی بنووسە');
      return;
    }

    setSubmitting(true);
    setPinError(null);

    try {
      const res = await fetch('/api/auth/google-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: googleProfile.email,
          employeeId: selectedEmp.id,
          pin: pinInput.trim(),
          googleUid: googleProfile.uid,
          photoUrl: googleProfile.photoUrl || selectedEmp.photoUrl,
          force: isSelectedEmpBoundToAnother,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error === 'INVALID_PIN') {
          setPinError('کۆدی نهێنی (PIN) هەڵەیە! تکایە پەیوەندی بە بەڕێوەبەر بکە ئەگەر کۆدەکەت بیرچووە.');
        } else if (data.error?.startsWith('ALREADY_BOUND')) {
          setPinError('ئەم کارمەندە پێشتر بەستراوەتەوە بە ئیمەیڵێکی تر!');
        } else {
          setPinError(data.error || 'هەڵەیەک ڕوویدا لە بەستنەوەی هەژماردا.');
        }
        return;
      }

      // Success! Create auth session
      const authUser: MobileAuthUser = {
        email: googleProfile.email,
        employeeId: selectedEmp.id,
        employeeName: selectedEmp.fullName3Part || selectedEmp.name,
        role: selectedEmp.role || 'Employee',
        photoUrl: googleProfile.photoUrl || selectedEmp.photoUrl || undefined,
        googleUid: googleProfile.uid,
        phone: selectedEmp.phone || undefined,
        loginTime: new Date().toISOString(),
        isFounder: Boolean(
          selectedEmp.id === 'emp-02' || 
          selectedEmp.name.includes('دارکۆ')
        ),
      };

      localStorage.setItem('ashley_mobile_auth', JSON.stringify(authUser));
      onBindingSuccess(authUser);
    } catch (err: any) {
      setPinError(err.message || 'هەڵەی سێرڤەر');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-[430px] mx-auto bg-[#f8fafc] text-slate-900 flex flex-col p-4 sm:p-5 dir-rtl font-sans select-none sm:shadow-2xl sm:border-x sm:border-slate-200/90" dir="rtl">
      {/* Header */}
      <div className="pt-2 pb-3 flex items-center justify-between border-b border-slate-200">
        <button
          type="button"
          onClick={handleSwitchAccount}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>گەڕانەوە</span>
        </button>

        <div className="text-center">
          <h2 className="text-sm font-black text-slate-900">دیاریکردنی کارمەند</h2>
          <span className="text-[10px] text-slate-500 font-medium">قوفڵکردنی هەژمار بە PIN</span>
        </div>

        <button
          type="button"
          onClick={handleSwitchAccount}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
          title="دەرچوون لەم ئیمەیڵە"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>دەرچوون</span>
        </button>
      </div>

      {/* Account Info & Switch Button Banner */}
      <div className="my-3 p-3 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] text-slate-500 block font-medium">ئیمەیڵی هەڵبژێردراو:</span>
            <span className="text-xs font-bold font-mono text-slate-900 truncate block mt-0.5" dir="ltr">
              {googleProfile.email}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSwitchAccount}
            className="shrink-0 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>گۆڕینی جیمەیڵ</span>
          </button>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 leading-relaxed flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>
            ئەگەر بە هەڵە ئەم ئیمەیڵەت هەڵبژاردووە، کلیک لە <b>گۆڕینی جیمەیڵ</b> بکە. تا ناوی خۆت هەڵنەبژێریت و کۆدی نهێنی (PIN) نەنووسیت، هیچ زانیارییەک لە سیستەمدا تۆمار نابێت.
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="گەڕان بەدوای ناوی کارمەند..."
          className="w-full h-11 bg-white border border-slate-300 rounded-xl pr-10 pl-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 shadow-xs"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute left-3 top-3 text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Employees List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 pb-6">
        {loadingBindings ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs font-bold">پشکنینی دۆخی کارمەندان...</span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            هیچ کارمەندێک نەدۆزرایەوە بەم ناوە.
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const boundEmail = boundEmployeeMap[emp.id];
            const isBoundToAnother = Boolean(boundEmail && boundEmail.toLowerCase() !== googleProfile.email.toLowerCase());

            return (
              <div
                key={emp.id}
                onClick={() => {
                  setSelectedEmp(emp);
                  setPinInput('');
                  setPinError(null);
                }}
                className="p-3 rounded-2xl border transition-all flex items-center justify-between bg-white hover:bg-slate-50 active:scale-[0.99] border-slate-200/90 cursor-pointer hover:border-amber-400 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                    {(emp.fullName3Part || emp.name).slice(0, 1)}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      {emp.fullName3Part || emp.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {emp.role || 'کارمەند'}
                    </span>
                  </div>
                </div>

                <div>
                  {isBoundToAnother ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-bold">
                      <Lock className="w-3 h-3 text-amber-600" />
                      <span>گواستنەوە بە PIN</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold">
                      هەڵبژاردن
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PIN Verification Modal */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedEmp(null)}
              className="absolute left-4 top-4 p-1.5 text-slate-400 hover:text-slate-700 rounded-xl bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pt-2 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-slate-900 mb-1">
                تەئکیدکردنەوەی ناسنامە
              </h3>
              <p className="text-xs text-slate-600">
                بەستنەوەی <b>{selectedEmp.fullName3Part || selectedEmp.name}</b> بە:
              </p>
              <p className="text-xs text-amber-600 font-mono font-bold mt-0.5" dir="ltr">
                {googleProfile.email}
              </p>
            </div>

            {isSelectedEmpBoundToAnother && (
              <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2 text-right">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span className="leading-relaxed">
                  ئەم کارمەندە پێشتر بە ئیمەیڵی <span className="font-mono font-bold" dir="ltr">{boundEmployeeMap[selectedEmp.id]}</span> قوفڵکراوە. بە نووسینی PIN، قوفڵەکەی دەگوازرێتەوە بۆ ئەم جیمەیڵە نوێیە.
                </span>
              </div>
            )}

            {pinError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmBinding} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-700 mb-1.5 font-bold">
                  کۆدی نهێنی (PIN)ی ٤ ژمارەیی بنووسە:
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  className="w-full h-12 bg-slate-50 border border-slate-300 rounded-xl text-center text-xl tracking-widest text-slate-900 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-12 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>قوفڵکردن و چوونەژوورەوە</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedEmp(null)}
                  className="px-4 h-12 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  پەشیمانبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
