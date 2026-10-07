'use client';

import { logger } from '@/lib/logger';
import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  X, 
  Search, 
  Clock, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  User,
  Calendar,
  Lock
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 font-sans" dir="rtl">
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>تۆماری مێژووی چاودێری و دەستکارییەکان (Audit Trail)</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 text-[10px] font-mono font-bold">
                  {filteredLogs.length} تۆمار
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                چاودێری کرداری سڕینەوە، دەستکاری، و خەزنکردنی دارایی و پۆلێنەکان
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search and Filter Pills */}
        <div className="p-3 border-b border-slate-200/80 bg-slate-50/40 flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="گەڕان لەناو دەستکارییەکان، ناو، یان بەروار..."
              className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 text-slate-900 placeholder:text-slate-400 transition-all"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setActionFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                actionFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
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
                  : 'text-emerald-700 hover:bg-emerald-50'
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
                  : 'text-amber-700 hover:bg-amber-50'
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
                  : 'text-rose-700 hover:bg-rose-50'
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
            <div className="divide-y divide-slate-100 border border-slate-200/90 rounded-xl overflow-hidden bg-white shadow-2xs">
              {filteredLogs.map((log) => {
                const actionBadgeClass = 
                  log.action === 'create' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' :
                  log.action === 'update' ? 'bg-amber-50 text-amber-700 border-amber-200/80' :
                  'bg-rose-50 text-rose-700 border-rose-200/80';

                const actionLabel = 
                  log.action === 'create' ? 'زیادکردن' :
                  log.action === 'update' ? 'دەستکاری' :
                  log.action === 'delete' ? 'سڕینەوە' : log.action;

                let formattedDate = log.timestamp;
                try {
                  formattedDate = format(new Date(log.timestamp), 'yyyy-MM-dd • hh:mm a');
                } catch (err) { logger.warn(err); }

                return (
                  <div key={log.id} className="p-3 flex items-start justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-start gap-2.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 mt-0.5 ${actionBadgeClass}`}>
                        {actionLabel}
                      </span>
                      <div>
                        <p className="text-xs font-medium text-slate-900 leading-relaxed">
                          {log.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{log.username || 'ئەدمین'}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{formattedDate}</span>
                          </span>
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
        <div className="p-3.5 border-t border-slate-200/80 bg-slate-50/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>تەواوی کردارەکان لە هەوری داتابەیس تۆمار کراون</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            داخستن
          </button>
        </div>

      </div>
    </div>
  );
}
