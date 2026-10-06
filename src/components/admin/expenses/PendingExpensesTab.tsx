'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Receipt, 
  RefreshCw, 
  Image as ImageIcon, 
  Eye, 
  Filter, 
  ExternalLink,
  DollarSign,
  AlertCircle,
  FileText,
  User,
  Calendar
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PendingExpenseRequest } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface PendingExpensesTabProps {
  onExpenseApproved?: () => void;
}

export function PendingExpensesTab({ onExpenseApproved }: PendingExpensesTabProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<PendingExpenseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject modal state
  const [rejectModalReq, setRejectModalReq] = useState<PendingExpenseRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/expenses/pending');
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error('Error fetching pending expenses:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (req: PendingExpenseRequest) => {
    setProcessingId(req.id);
    try {
      const res = await fetch('/api/expenses/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          requestId: req.id,
          approverName: 'بەڕێوەبەر (سیستەمی وێبسایت)',
        }),
      });
      const data = await res.json();
      if (data.success) {
        const voucherInfo = data.voucher?.name
          ? (data.isNewVoucher
              ? ` ✨ (لیستی نوێ دروستکرا: ${data.voucher.name})`
              : ` 📁 (خرایە نێو لیستی کراوەی: ${data.voucher.name})`)
          : '';
        toast({
          title: '✅ مەسروفات پەسەندکرا',
          description: `داواکاری ${req.employeeName} بە بڕی ${req.amount.toLocaleString()} دینار پەسەندکرا.${voucherInfo}`,
        });
        loadRequests();
        if (onExpenseApproved) onExpenseApproved();
      } else {
        toast({
          title: '❌ هەڵە لە پەسەندکردن',
          description: data.error || 'تکایە دووبارە تاقی بکەرەوە.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '❌ هەڵەی پەیوەندی',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalReq) return;
    setProcessingId(rejectModalReq.id);
    try {
      const res = await fetch('/api/expenses/pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          requestId: rejectModalReq.id,
          approverName: 'بەڕێوەبەر (سیستەمی وێبسایت)',
          reason: rejectReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: '❌ داواکاری ڕەتکرایەوە',
          description: `داواکاری مەسروفاتی ${rejectModalReq.employeeName} ڕەتکرایەوە و کارمەند ئاگادارکرایەوە.`,
        });
        setRejectModalReq(null);
        setRejectReason('');
        loadRequests();
      } else {
        toast({
          title: '❌ هەڵە لە ڕەتکردنەوە',
          description: data.error || 'تکایە دووبارە تاقی بکەرەوە.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: '❌ هەڵەی پەیوەندی',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const pendingTotalAmount = requests
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div className="space-y-6 dir-rtl" dir="rtl">
      {/* 📊 SUMMARY BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 dark:from-amber-950/30 dark:to-transparent p-4 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">داواکارییە هەڵپەسێردراوەکان</p>
            <p className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-1">{pendingCount} داواکاری</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 dark:from-emerald-950/30 dark:to-transparent p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/40 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">کۆی بڕی هەڵپەسێردراو</p>
            <p className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1">{pendingTotalAmount.toLocaleString()} IQD</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 dark:from-blue-950/30 dark:to-transparent p-4 rounded-2xl border border-blue-200/80 dark:border-blue-800/40 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400">سەرچاوەی داواکارییەکان</p>
            <p className="text-sm font-black text-blue-900 dark:text-blue-200 mt-1">بۆتی تەلەگرام & وێبسایت</p>
            <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80">پەسەندکردن ڕاستەوخۆ دەچێتە سەر خەرجی</p>
          </div>
          <button 
            type="button"
            onClick={loadRequests} 
            disabled={isLoading}
            className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 hover:bg-blue-500/30 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            title="نوێکردنەوە"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 🧭 FILTER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100/80 dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">فلتەری دۆخ:</span>
          
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            ⏳ هەڵپەسێردراو ({pendingCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            ✅ پەسەندکراو
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'rejected'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            ❌ ڕەتکراوە
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#007AFF] text-white shadow-xs'
                : 'bg-white dark:bg-[#2c2c2e] text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            هەموو ({requests.length})
          </button>
        </div>

        <button
          type="button"
          onClick={loadRequests}
          disabled={isLoading}
          className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>نوێکردنەوەی خێرا</span>
        </button>
      </div>

      {/* 📋 LIST OF REQUESTS */}
      {filteredRequests.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#1c1c1e] rounded-3xl border border-slate-200/80 dark:border-white/10 space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
            <Receipt className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
            هیچ داواکارییەکی مەسروفات نەدۆزرایەوە
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            کاتێک کارمەندان لە ڕێگەی بۆتی تەلەگرام یان بەشی داواکاری خەرجی تۆمار دەکەن، لێرە بە وردی پێشان دەدرێت و دەتوانیت پەسەندیان بکەیت.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className={`p-5 bg-white dark:bg-[#1c1c1e] rounded-3xl border transition-all flex flex-col justify-between shadow-2xs hover:shadow-md ${
                req.status === 'pending'
                  ? 'border-amber-300/80 dark:border-amber-800/50 bg-gradient-to-b from-amber-500/5 to-transparent'
                  : req.status === 'approved'
                  ? 'border-emerald-200/80 dark:border-emerald-900/40'
                  : 'border-red-200/80 dark:border-red-900/40 opacity-75'
              }`}
            >
              <div className="space-y-4">
                {/* Header: Employee & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 flex items-center justify-center font-black text-sm">
                      {req.employeeName.slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                        {req.employeeName}
                      </h4>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        کۆد: {req.employeeId}
                      </p>
                    </div>
                  </div>

                  <div>
                    {req.status === 'pending' && (
                      <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold text-[11px] border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        هەڵپەسێردراو
                      </span>
                    )}
                    {req.status === 'approved' && (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        پەسەندکراو
                      </span>
                    )}
                    {req.status === 'rejected' && (
                      <span className="px-2.5 py-1 rounded-xl bg-red-500/10 text-red-700 dark:text-red-400 font-bold text-[11px] border border-red-200 dark:border-red-800 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        ڕەتکراوە
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount & Category */}
                <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">بڕی پارە</span>
                    <span className="text-lg font-black text-slate-900 dark:text-white">
                      {req.amount.toLocaleString()} <span className="text-xs text-slate-500">دینار</span>
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-slate-500 block">جۆری مەسروف</span>
                    <span className="text-xs font-bold text-[#007AFF] bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-lg inline-block border border-blue-200/60 dark:border-blue-800/40">
                      {req.category}
                    </span>
                  </div>
                </div>

                {/* Transport Route if available */}
                {(req.route || req.from || req.to) && (
                  <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200/50 dark:border-blue-900/40 space-y-1">
                    <span className="text-[11px] font-bold text-[#007AFF] flex items-center gap-1">
                      <span>🚖</span> هاتوچۆ و ڕێڕەو:
                    </span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {req.route || `${req.from || '—'} ⬅️ ${req.to || '—'}`}
                    </p>
                  </div>
                )}

                {/* Note / Reason */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">هۆکار و تێبینی:</span>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-black/20 p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5">
                    {req.note || 'بەبێ تێبینی'}
                  </p>
                </div>

                {/* Receipt Photo Thumbnail (if available) */}
                {req.receiptPhotoUrl ? (
                  <div className="flex items-center justify-between p-2.5 bg-slate-100/60 dark:bg-white/5 rounded-2xl border border-slate-200/60 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">وێنەی پسوولە هەیە</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedImage(req.receiptPhotoUrl!)}
                      className="px-3 py-1 bg-white dark:bg-[#2c2c2e] hover:bg-slate-50 text-xs font-bold text-[#007AFF] rounded-xl border border-slate-200 dark:border-white/10 flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      بینین
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1">
                    <span>📸</span> بەبێ هاوپێچی پسوولە
                  </p>
                )}

                {/* Date & Submitter Info */}
                <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {req.dateStr}
                  </span>
                  <span>{new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* Approval metadata */}
                {req.approvedBy && (
                  <div className="text-[11px] p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                    <span>بڕیاردەر: <b>{req.approvedBy}</b></span>
                    {req.rejectionReason && <p className="text-red-500 mt-0.5">هۆکاری ڕەتکردنەوە: {req.rejectionReason}</p>}
                  </div>
                )}
              </div>

              {/* Actions for Pending Requests */}
              {req.status === 'pending' && (
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => handleApprove(req)}
                    disabled={processingId === req.id}
                    className="w-full py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {processingId === req.id ? 'خەریکە...' : 'پەسەندکردن'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRejectModalReq(req);
                      setRejectReason('');
                    }}
                    disabled={processingId === req.id}
                    className="w-full py-2.5 px-3 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    ڕەتکردنەوە
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 🖼️ IMAGE PREVIEW MODAL */}
      {selectedImage && (
        <Dialog open={Boolean(selectedImage)} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-2xl dir-rtl p-4 bg-white dark:bg-[#1c1c1e] rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#007AFF]" />
                وێنەی پسوولەی داواکراو
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 flex items-center justify-center max-h-[70vh] overflow-hidden rounded-2xl bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={selectedImage} 
                alt="Receipt" 
                className="max-h-[70vh] w-auto object-contain rounded-2xl shadow-lg"
              />
            </div>
            <DialogFooter className="mt-4 flex justify-between items-center">
              <a
                href={selectedImage}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-[#007AFF] flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                کردنەوە لە پەڕەیەکی نوێ
              </a>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                داخستن
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ❌ REJECT CONFIRMATION MODAL */}
      {rejectModalReq && (
        <Dialog open={Boolean(rejectModalReq)} onOpenChange={() => setRejectModalReq(null)}>
          <DialogContent className="max-w-md dir-rtl p-6 bg-white dark:bg-[#1c1c1e] rounded-3xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                ڕەتکردنەوەی داواکاری مەسروفات
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                ئایا دڵنیایت لە ڕەتکردنەوەی داواکاری مەسروفاتی کارمەند <b>{rejectModalReq.employeeName}</b> بە بڕی <b>{rejectModalReq.amount.toLocaleString()} دینار</b>؟
              </p>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">
                  هۆکاری ڕەتکردنەوە (ئارەزوومەندانە):
                </label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="نموونە: پسوولە نادیارە، بڕەکە زۆرە..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:outline-hidden"
                />
              </div>
            </div>
            <DialogFooter className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={processingId === rejectModalReq.id}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                {processingId === rejectModalReq.id ? 'خەریکە...' : 'بەڵێ، ڕەتی بکەرەوە'}
              </button>
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                پاشگەزبوونەوە
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
