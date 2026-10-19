'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Mail, 
  Search, 
  Trash2, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  UserCheck, 
  ExternalLink,
  Users,
  Clock,
  Lock,
  Loader2,
  X
} from 'lucide-react';
import { ASHLEY_OFFICIAL_EMPLOYEES, AshleyOfficialEmployee } from '@/lib/ashley-employees';
import { format } from 'date-fns';

interface GoogleBindingInfo {
  email: string;
  employeeId: string;
  employeeName: string;
  googleUid?: string;
  photoUrl?: string;
  linkedAt: string;
}

export function AdminGoogleBindingsManager() {
  const [bindings, setBindings] = useState<Record<string, GoogleBindingInfo>>({});
  const [boundEmployeeMap, setBoundEmployeeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'bound' | 'unbound'>('all');

  // Manual Bind Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState<AshleyOfficialEmployee | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Deleting State
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  // Load Bindings from Supabase
  const loadBindings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google-binding');
      const data = await res.json();
      if (data.success) {
        setBindings(data.allBindings || {});
        setBoundEmployeeMap(data.boundEmployeeMap || {});
      }
    } catch (err) {
      console.error('[AdminGoogleBindingsManager] Error loading bindings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBindings();
  }, [loadBindings]);

  // Unlink / Delete Google Binding
  const handleUnbind = async (email: string, employeeName: string) => {
    if (!confirm(`ئایا دڵنیایت لە هەڵوەشاندنەوەی بەستنەوەی ئیمەیڵی (${email}) بۆ کارمەند (${employeeName})؟`)) {
      return;
    }

    setDeletingEmail(email);
    try {
      const res = await fetch(`/api/auth/google-binding?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await loadBindings();
      } else {
        alert(data.error || 'هەڵەیەک ڕوویدا لە هەڵوەشاندنەوەی هەژمار');
      }
    } catch (err: any) {
      alert(err.message || 'هەڵە لە پەیوەندیکردن');
    } finally {
      setDeletingEmail(null);
    }
  };

  // Submit Manual Binding
  const handleSaveManualBinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee) return;

    const cleanEmail = manualEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setModalError('تکایە ناونیشانی ئیمەیڵێکی دروست بنووسە');
      return;
    }

    setSavingManual(true);
    setModalError(null);

    try {
      const res = await fetch('/api/auth/google-binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          employeeId: targetEmployee.id,
          employeeName: targetEmployee.fullName3Part || targetEmployee.name,
          force: true, // Admin override without PIN
        }),
      });

      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        setTargetEmployee(null);
        setManualEmail('');
        await loadBindings();
      } else {
        setModalError(data.error || 'هەڵە لە پاشەکەوتکردن');
      }
    } catch (err: any) {
      setModalError(err.message || 'هەڵە لە پەیوەندیکردن');
    } finally {
      setSavingManual(false);
    }
  };

  // Open modal for specific employee
  const openManualModal = (emp: AshleyOfficialEmployee) => {
    setTargetEmployee(emp);
    setManualEmail(boundEmployeeMap[emp.id] || '');
    setModalError(null);
    setModalOpen(true);
  };

  // Filtered & Combined Employees
  const employeeRows = useMemo(() => {
    return ASHLEY_OFFICIAL_EMPLOYEES.map((emp) => {
      const boundEmail = boundEmployeeMap[emp.id] || null;
      const bindingInfo = boundEmail ? bindings[boundEmail] : null;

      return {
        ...emp,
        isBound: Boolean(boundEmail),
        boundEmail,
        bindingInfo,
      };
    }).filter((item) => {
      // Filter tab
      if (filterMode === 'bound' && !item.isBound) return false;
      if (filterMode === 'unbound' && item.isBound) return false;

      // Search query
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const name = (item.fullName3Part || item.name).toLowerCase();
      const email = (item.boundEmail || '').toLowerCase();
      const code = item.id.toLowerCase();
      const role = (item.role || '').toLowerCase();

      return name.includes(term) || email.includes(term) || code.includes(term) || role.includes(term);
    });
  }, [boundEmployeeMap, bindings, filterMode, searchTerm]);

  const totalEmployees = ASHLEY_OFFICIAL_EMPLOYEES.length;
  const totalBound = Object.keys(boundEmployeeMap).length;
  const totalUnbound = totalEmployees - totalBound;

  return (
    <div className="space-y-5 max-w-7xl mx-auto transition-opacity duration-300">
      
      {/* 📊 SUMMARY KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Employees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 block mb-1">کۆی ستافی فەرمی ئاشڵی</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 font-mono">{totalEmployees}</span>
              <span className="text-xs text-slate-400 font-medium">کارمەند</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Bound to Google */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-700 block mb-1">بەستراوەتەوە بە Gmail</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 font-mono">{totalBound}</span>
              <span className="text-xs text-emerald-600/80 font-medium font-mono">
                ({Math.round((totalBound / totalEmployees) * 100)}%)
              </span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Unbound / Pending */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-700 block mb-1">هێشتا نەبەستراوەتەوە</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600 font-mono">{totalUnbound}</span>
              <span className="text-xs text-amber-600/80 font-medium">چاوەڕوانە</span>
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 🧭 FILTER & CONTROL BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="گەڕان بەپێی ناوی کارمەند، ژمارەی ناسنامە، یان ئیمەیڵ..."
            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-white text-blue-600 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            هەموو ({totalEmployees})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('bound')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'bound'
                ? 'bg-white text-emerald-600 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            بەستراوەتەوە ({totalBound})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('unbound')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filterMode === 'unbound'
                ? 'bg-white text-amber-600 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            نەبەستراوەتەوە ({totalUnbound})
          </button>
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={loadBindings}
          disabled={loading}
          className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          title="نوێکردنەوە لە Supabase"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>نوێکردنەوە</span>
        </button>
      </div>

      {/* 📋 MASTER DATA TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="py-3.5 px-4">کارمەند</th>
                <th className="py-3.5 px-3">ناسنامە</th>
                <th className="py-3.5 px-3">بەش / پلە</th>
                <th className="py-3.5 px-4">هەژماری Google (Gmail)</th>
                <th className="py-3.5 px-3">ڕێکەوتی بەستنەوە</th>
                <th className="py-3.5 px-3">دۆخ</th>
                <th className="py-3.5 px-4 text-center">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {employeeRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    هیچ ئەنجامێک نەدۆزرایەوە بۆ گەڕانەکەت.
                  </td>
                </tr>
              ) : (
                employeeRows.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Employee Profile */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {(emp.fullName3Part || emp.name).slice(0, 1)}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block">
                            {emp.fullName3Part || emp.name}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono" dir="ltr">
                            {emp.phone || '—'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Employee ID */}
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200" dir="ltr">
                        {emp.id}
                      </span>
                    </td>

                    {/* Role / Dept */}
                    <td className="py-3 px-3">
                      <span className="text-slate-600 text-xs">
                        {emp.role || 'کارمەند'}
                      </span>
                    </td>

                    {/* Google Email */}
                    <td className="py-3 px-4">
                      {emp.isBound && emp.boundEmail ? (
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
                          </div>
                          <span className="font-mono text-xs font-bold text-slate-800" dir="ltr">
                            {emp.boundEmail}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-xs">
                          نەبەستراوەتەوە
                        </span>
                      )}
                    </td>

                    {/* Linked Date */}
                    <td className="py-3 px-3">
                      {emp.bindingInfo?.linkedAt ? (
                        <span className="text-[11px] text-slate-500 font-mono" dir="ltr">
                          {format(new Date(emp.bindingInfo.linkedAt), 'yyyy-MM-dd HH:mm')}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3">
                      {emp.isBound ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>قوفڵکراو</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>چاوەڕوانە</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {emp.isBound && emp.boundEmail ? (
                          <button
                            type="button"
                            onClick={() => handleUnbind(emp.boundEmail!, emp.fullName3Part || emp.name)}
                            disabled={deletingEmail === emp.boundEmail}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 border border-rose-200 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                            title="هەڵوەشاندنەوەی قوفڵی ئیمەیڵ لەسەر ئەم کارمەندە"
                          >
                            {deletingEmail === emp.boundEmail ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            <span>لابردن</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openManualModal(emp)}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-600 border border-blue-200 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>بەستنەوە بە دەستی</span>
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📝 MANUAL BINDING MODAL */}
      {modalOpen && targetEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900">
                <Mail className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-sm">بەستنەوەی هەژماری Google بە دەستی</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-bold block">کارمەندی دیاریکراو:</span>
              <span className="text-sm font-black text-slate-900 block">
                {targetEmployee.fullName3Part || targetEmployee.name}
              </span>
              <span className="text-xs text-slate-500 font-mono" dir="ltr">
                کۆد: {targetEmployee.id} • {targetEmployee.role}
              </span>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveManualBinding} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ناونیشانی Gmailـی ئەم کارمەندە بنووسە:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    dir="ltr"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="employee@gmail.com"
                    className="w-full h-11 bg-white border border-slate-300 rounded-xl pr-10 pl-3 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  💡 بە دانانی ئەم ئیمەیڵە، لەمەودوا ئەم کارمەندە کاتێک لە مۆبایلەکەیەوە Sign in with Google دەکات، ڕاستەوخۆ دەچێتە سەر پرۆفایلەکەی بەبێ هیچ پرسیارێک.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingManual}
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingManual ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>پاشەکەوتکردن و قوفڵکردن</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
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
