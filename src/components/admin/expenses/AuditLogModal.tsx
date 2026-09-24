'use client';

import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  X, 
  Search, 
  Clock, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from 'lucide-react';
import type { ActivityLog } from '@/lib/types';
import { format } from 'date-fns';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ActivityLog[];
  onClearLogs?: () => void;
}

export function AuditLogModal({
  isOpen,
  onClose,
  logs = [],
  onClearLogs,
}: AuditLogModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'create' | 'update' | 'delete'>('all');

  const filteredLogs = useMemo(() => {
    return logs
      .filter(log => {
        if (actionFilter !== 'all' && log.action !== actionFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          (log.description || '').toLowerCase().includes(q) ||
          (log.username || '').toLowerCase().includes(q) ||
          (log.entity || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [logs, actionFilter, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 font-sans" dir="rtl">
      <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/80 dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>تۆماری مێژووی چاودێری و دەستکارییەکان (Audit Trail)</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[10px] font-mono">
                  {filteredLogs.length} تۆمار
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                چاودێری کرداری سڕینەوە، دەستکاری، و خەزنکردنی دارایی و پۆلێنەکان
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search and Filter Pills */}
        <div className="p-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/40 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="گەڕان لەناو دەستکارییەکان، ناو، یان بەروار..."
              className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActionFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                actionFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
              }`}
            >
              هەمووی
            </button>
            <button
              type="button"
              onClick={() => setActionFilter('create')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                actionFilter === 'create'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              زیادکردن
            </button>
            <button
              type="button"
              onClick={() => setActionFilter('update')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                actionFilter === 'update'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
              }`}
            >
              دەستکاری
            </button>
            <button
              type="button"
              onClick={() => setActionFilter('delete')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                actionFilter === 'delete'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
              }`}
            >
              سڕینەوە
            </button>
          </div>
        </div>

        {/* Logs List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <Clock className="w-8 h-8 opacity-30" />
              <span>هیچ چالاکییەکی تۆمارکراو بەردەست نییە.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-white/[0.02]">
              {filteredLogs.map((log) => {
                const actionBadgeClass = 
                  log.action === 'create' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                  log.action === 'update' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                  'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800';

                const actionLabel = 
                  log.action === 'create' ? 'زیادکردن' :
                  log.action === 'update' ? 'دەستکاری' :
                  log.action === 'delete' ? 'سڕینەوە' : log.action;

                let formattedDate = log.timestamp;
                try {
                  formattedDate = format(new Date(log.timestamp), 'yyyy-MM-dd • hh:mm a');
                } catch {}

                return (
                  <div key={log.id} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 mt-0.5 ${actionBadgeClass}`}>
                        {actionLabel}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-slate-900 dark:text-white leading-relaxed">
                          {log.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                          <span>👤 {log.username || 'ئەدمین'}</span>
                          <span>•</span>
                          <span>📅 {formattedDate}</span>
                          {log.entity && (
                            <>
                              <span>•</span>
                              <span className="capitalize">[{log.entity}]</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            🔒 تەواوی کردارەکان لە هەوری داتابەیس تۆمار کراون
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            داخستن
          </button>
        </div>

      </div>
    </div>
  );
}
