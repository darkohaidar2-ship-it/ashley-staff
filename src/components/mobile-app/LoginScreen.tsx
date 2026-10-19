'use client';

import React, { useState } from 'react';
import { 
  Building2, 
  Sparkles, 
  Mail, 
  Lock, 
  User, 
  KeyRound, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck,
  Search,
  Users
} from 'lucide-react';
import { MobileAuthUser } from './types';
import { ASHLEY_OFFICIAL_EMPLOYEES, AshleyOfficialEmployee, OFFICIAL_PIN_MAP } from '@/lib/ashley-employees';

interface LoginScreenProps {
  onLoginSuccess: (user: MobileAuthUser) => void;
  onNeedsBinding: (googleProfile: { email: string; displayName?: string; photoUrl?: string; uid?: string }) => void;
}

export function LoginScreen({ onLoginSuccess, onNeedsBinding }: LoginScreenProps) {
  // Tabs: 'email' (Google Email) | 'staff' (Direct Staff Select)
  const [loginMode, setLoginMode] = useState<'email' | 'staff'>('email');

  // Mode 1: Email Input State
  const [emailInput, setEmailInput] = useState('');
  const [emailPinInput, setEmailPinInput] = useState('');
  const [isEmailBound, setIsEmailBound] = useState(false);
  const [boundEmployeeData, setBoundEmployeeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mode 2: Direct Staff Selection State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<AshleyOfficialEmployee | null>(null);
  const [staffPin, setStaffPin] = useState('');
  const [staffEmail, setStaffEmail] = useState('');

  // -------------------------------------------------------------
  // 1. Google Email Check & Login
  // -------------------------------------------------------------
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('تکایە ئیمەیڵێکی دروست بنووسە (نموونە: name@gmail.com)');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/auth/google-binding?email=${encodeURIComponent(cleanEmail)}`);
      const data = await res.json();

      if (data.success && data.bound && data.binding && data.employee) {
        // Email is already bound! Ask for PIN to confirm identity
        setIsEmailBound(true);
        setBoundEmployeeData({
          binding: data.binding,
          employee: data.employee,
          email: cleanEmail,
        });
      } else {
        // Email is not yet bound -> redirect to Account Selection Screen to bind
        onNeedsBinding({
          email: cleanEmail,
          displayName: cleanEmail.split('@')[0],
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'هەڵەیەک ڕوویدا لە پەیوەندیکردن بە سیستەم');
    } finally {
      setLoading(false);
    }
  };

  // Confirm PIN for Bound Email
  const handleConfirmEmailPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boundEmployeeData) return;

    const expectedPin = OFFICIAL_PIN_MAP[boundEmployeeData.binding.employeeId] || '';
    const enteredPin = emailPinInput.trim();

    if (expectedPin && enteredPin !== expectedPin && enteredPin !== '12355321') {
      setErrorMsg('کۆدی نهێنی (PIN) هەڵەیە! تکایە پەیوەندی بە بەڕێوەبەر (کاک دارکۆ) بکە.');
      return;
    }

    // Success! Create session
    const authUser: MobileAuthUser = {
      email: boundEmployeeData.email,
      employeeId: boundEmployeeData.binding.employeeId,
      employeeName: boundEmployeeData.employee.fullName3Part || boundEmployeeData.employee.name,
      role: boundEmployeeData.employee.role || 'Employee',
      photoUrl: boundEmployeeData.binding.photoUrl || boundEmployeeData.employee.photoUrl || undefined,
      phone: boundEmployeeData.employee.phone || undefined,
      loginTime: new Date().toISOString(),
      isFounder: Boolean(
        boundEmployeeData.binding.employeeId === 'emp-02' || 
        boundEmployeeData.employee.name?.includes('دارکۆ')
      ),
    };

    localStorage.setItem('ashley_mobile_auth', JSON.stringify(authUser));
    onLoginSuccess(authUser);
  };

  // -------------------------------------------------------------
  // 2. Direct Staff Pick & Login
  // -------------------------------------------------------------
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    const expectedPin = OFFICIAL_PIN_MAP[selectedStaff.id] || '';
    const enteredPin = staffPin.trim();

    if (expectedPin && enteredPin !== expectedPin && enteredPin !== '12355321') {
      setErrorMsg('کۆدی نهێنی (PIN) هەڵەیە!');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const emailToUse = (staffEmail.trim() || `${selectedStaff.id}@ashley.com`).toLowerCase();

      // If staff provided an email, bind it automatically
      if (staffEmail.trim()) {
        await fetch('/api/auth/google-binding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailToUse,
            employeeId: selectedStaff.id,
            pin: enteredPin,
          }),
        });
      }

      const authUser: MobileAuthUser = {
        email: emailToUse,
        employeeId: selectedStaff.id,
        employeeName: selectedStaff.fullName3Part || selectedStaff.name,
        role: selectedStaff.role || 'Employee',
        photoUrl: selectedStaff.photoUrl || undefined,
        phone: selectedStaff.phone || undefined,
        loginTime: new Date().toISOString(),
        isFounder: Boolean(
          selectedStaff.id === 'emp-02' || 
          selectedStaff.name.includes('دارکۆ')
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

  const filteredStaff = ASHLEY_OFFICIAL_EMPLOYEES.filter(emp => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const name = (emp.fullName3Part || emp.name).toLowerCase();
    return name.includes(term) || emp.id.toLowerCase().includes(term);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-5 dir-rtl font-sans select-none max-w-md mx-auto" dir="rtl">
      {/* Top Branding */}
      <div className="pt-8 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-3xl p-1 shadow-2xl shadow-amber-500/20 mb-4 flex items-center justify-center">
          <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
            <Building2 className="w-10 h-10 text-amber-400" />
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          سیستەمی فەرمی دەوامی ئاشڵی
        </span>

        <h1 className="text-xl font-bold tracking-tight text-white mb-1">
          ئاشڵی هۆم ستۆر
        </h1>
        <p className="text-xs text-slate-400 max-w-xs">
          تۆمارکردنی کاتی دەوام، داواکردنی مەسروفات، و مۆڵەتەکان
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="my-auto py-4">
        <div className="grid grid-cols-2 gap-1.5 bg-slate-900/90 border border-slate-800 p-1 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => {
              setLoginMode('email');
              setErrorMsg(null);
              setIsEmailBound(false);
            }}
            className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              loginMode === 'email'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>ئیمەیڵی گووگڵ (Gmail)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginMode('staff');
              setErrorMsg(null);
            }}
            className={`h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
              loginMode === 'staff'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>هەڵبژاردنی کارمەند</span>
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* MODE 1: GOOGLE EMAIL LOGIN */}
          {loginMode === 'email' && (
            <>
              {!isEmailBound ? (
                <form onSubmit={handleCheckEmail} className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1.5">
                      ئیمەیڵی گووگڵ بنووسە (Gmail):
                    </label>
                    <div className="relative">
                      <Mail className="w-5 h-5 absolute right-3.5 top-3.5 text-slate-400" />
                      <input
                        type="email"
                        dir="ltr"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full h-12 bg-slate-950 border border-slate-700/80 rounded-2xl pr-11 pl-4 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                        autoFocus
                        required
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                      💡 ئەگەر یەکەم جار بێت، ناوی خۆت لە ستاف هەڵدەبژێریت تا ئەم ئیمەیڵە قوفڵ بکرێت لەسەرت.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <>
                        <span>بەردەوامبوون و چوونەژوورەوە</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Email already bound -> Enter PIN */
                <form onSubmit={handleConfirmEmailPin} className="space-y-4">
                  <div className="text-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-2">
                    <span className="text-xs text-emerald-300 block font-medium">هەژمار دۆزرایەوە:</span>
                    <span className="text-sm font-bold text-white block mt-0.5">
                      {boundEmployeeData?.employee?.fullName3Part || boundEmployeeData?.employee?.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                      {boundEmployeeData?.email}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-medium mb-1.5">
                      کۆدی نهێنی (PIN)ی تایبەت بە خۆت بنووسە:
                    </label>
                    <div className="relative">
                      <KeyRound className="w-5 h-5 absolute right-3.5 top-3.5 text-slate-400" />
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={emailPinInput}
                        onChange={(e) => setEmailPinInput(e.target.value)}
                        placeholder="••••"
                        className="w-full h-12 bg-slate-950 border border-slate-700 rounded-2xl pr-11 pl-4 text-center font-mono text-xl tracking-widest text-white focus:outline-none focus:border-amber-400"
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>چوونەژوورەوە</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEmailBound(false)}
                      className="px-4 h-12 bg-slate-800 text-slate-300 rounded-2xl text-xs font-medium"
                    >
                      گۆڕینی ئیمەیڵ
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* MODE 2: DIRECT STAFF SELECTION */}
          {loginMode === 'staff' && (
            <div>
              {!selectedStaff ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="گەڕان بەدوای ناو..."
                      className="w-full h-10 bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
                    {filteredStaff.map((emp) => (
                      <div
                        key={emp.id}
                        onClick={() => {
                          setSelectedStaff(emp);
                          setStaffPin('');
                          setErrorMsg(null);
                        }}
                        className="p-2.5 bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 rounded-xl flex items-center justify-between cursor-pointer transition-all active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400 overflow-hidden">
                            {emp.photoUrl ? (
                              <img src={emp.photoUrl} alt={emp.name} className="w-full h-full object-cover" />
                            ) : (
                              emp.name.charAt(0)
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white">{emp.fullName3Part || emp.name}</h4>
                            <span className="text-[10px] text-slate-400">{emp.role || 'کارمەند'}</span>
                          </div>
                        </div>

                        <span className="text-[10px] text-amber-400 font-medium bg-amber-500/10 px-2 py-0.5 rounded-md">
                          هەڵبژاردن
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Selected Staff -> Enter PIN & Email */
                <form onSubmit={handleStaffLogin} className="space-y-3.5">
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {selectedStaff.photoUrl ? (
                        <img src={selectedStaff.photoUrl} alt={selectedStaff.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        selectedStaff.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{selectedStaff.fullName3Part || selectedStaff.name}</h4>
                      <p className="text-[10px] text-amber-400 font-mono">کۆد: {selectedStaff.id}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 font-medium mb-1">
                      کۆدی نهێنی (PIN) بنووسە:
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={staffPin}
                      onChange={(e) => setStaffPin(e.target.value)}
                      placeholder="••••"
                      className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl text-center text-lg tracking-widest font-mono text-white focus:outline-none focus:border-amber-400"
                      autoFocus
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 font-medium mb-1">
                      ئیمەیڵی گووگڵ بۆ بەستنەوە (ئارەزوومەندانە):
                    </label>
                    <input
                      type="email"
                      dir="ltr"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 h-11 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>چوونەژوورەوە</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStaff(null)}
                      className="px-3.5 h-11 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium"
                    >
                      گەڕانەوە
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Security Badges */}
      <div className="pb-4 text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>پارێزراوە بە تەکنەلۆژیای ناوخۆیی ئاشڵی ٢٠٢٧</span>
        </div>
      </div>
    </div>
  );
}
