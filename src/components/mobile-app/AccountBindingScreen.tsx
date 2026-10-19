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
  Sparkles
} from 'lucide-react';
import { ASHLEY_OFFICIAL_EMPLOYEES, AshleyOfficialEmployee } from '@/lib/ashley-employees';
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
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.error === 'INVALID_PIN') {
          setPinError('کۆدی نهێنی (PIN) هەڵەیە! تکایە پەیوەندی بە بەڕێوەبەر (کاک دارکۆ) بکە ئەگەر کۆدەکەت بیرچووە.');
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
    <div className="min-h-screen bg-slate-900 text-white flex flex-col p-4 dir-rtl font-sans" dir="rtl">
      {/* Header */}
      <div className="pt-4 pb-3 flex items-center justify-between border-b border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-white">هەڵبژاردنی ناوی کارمەند</h2>
          <p className="text-xs text-amber-400/90 font-mono" dir="ltr">
            {googleProfile.email}
          </p>
        </div>
        <div className="w-7" />
      </div>

      {/* Info notice */}
      <div className="my-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-300 leading-relaxed flex items-start gap-2">
        <Sparkles className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
        <span>
          تکایە <b>ناوی خۆت لە لیستەکە هەڵبژێرە</b> تاوەکو ئەم ئیمەیڵەی گووگڵ تەنها بۆ هەژماری دەوامی تۆ قوفڵ بکرێت.
        </span>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="گەڕان بەدوای ناوی کارمەند..."
          className="w-full h-11 bg-slate-800/90 border border-slate-700/80 rounded-xl pr-10 pl-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute left-3 top-3 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Employees List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 pb-6">
        {loadingBindings ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs">پشکنینی دۆخی کارمەندان...</span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
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
                  if (!isBoundToAnother) {
                    setSelectedEmp(emp);
                    setPinInput('');
                    setPinError(null);
                  }
                }}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                  isBoundToAnother
                    ? 'bg-slate-900/60 border-slate-800/80 opacity-50 cursor-not-allowed'
                    : 'bg-slate-800/70 hover:bg-slate-800 active:scale-[0.99] border-slate-700/60 cursor-pointer hover:border-amber-500/40 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700/80 border border-slate-600 flex items-center justify-center font-bold text-xs text-amber-400 overflow-hidden">
                    {emp.photoUrl ? (
                      <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                    ) : (
                      emp.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white mb-0.5">
                      {emp.fullName3Part || emp.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">
                        کۆد: {emp.id}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-700/60 text-slate-300">
                        {emp.role || 'کارمەند'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  {isBoundToAnother ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20">
                      <Lock className="w-3 h-3" />
                      قوفڵکراوە
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-medium">
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedEmp(null)}
              className="absolute left-4 top-4 p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center pt-2 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                تەئکیدکردنەوەی ناسنامە
              </h3>
              <p className="text-xs text-slate-400">
                بەستنەوەی <b>{selectedEmp.fullName3Part || selectedEmp.name}</b> بەم ئیمەیڵە:
              </p>
              <p className="text-xs text-amber-400 font-mono mt-1" dir="ltr">
                {googleProfile.email}
              </p>
            </div>

            {pinError && (
              <div className="mb-4 p-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmBinding} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5 font-medium">
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
                  className="w-full h-12 bg-slate-800 border border-slate-700 rounded-xl text-center text-xl tracking-widest text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
                  className="px-4 h-12 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
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
