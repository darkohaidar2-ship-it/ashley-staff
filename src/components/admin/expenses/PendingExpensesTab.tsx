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
  Calendar,
  Camera,
  Car,
  ArrowLeft
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
              ? ` (لیستی نوێ دروستکرا: ${data.voucher.name})`
              : ` (خرایە نێو لیستی کراوەی: ${data.voucher.name})`)
          : '';
        toast({
          title: 'مەسروفات پەسەندکرا',
          description: `داواکاری ${req.employeeName} بە بڕی ${req.amount.toLocaleString()} دینار پەسەندکرا.${voucherInfo}`,
        });
        loadRequests();
        if (onExpenseApproved) onExpenseApproved();
      } else {
        toast({
          title: 'هەڵە لە پەسەندکردن',
          description: data.error || 'تکایە دووبارە تاقی بکەرەوە.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'هەڵەی پەیوەندی',
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
          title: 'داواکاری ڕەتکرایەوە',
          description: `داواکاری مەسروفاتی ${rejectModalReq.employeeName} ڕەتکرایەوە و کارمەند ئاگادارکرایەوە.`,
        });
        setRejectModalReq(null);
        setRejectReason('');
        loadRequests();
      } else {
        toast({
          title: 'هەڵە لە ڕەتکردنەوە',
          description: data.error || 'تکایە دووبارە تاقی بکەرەوە.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'هەڵەی پەیوەندی',
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
    <div className="space-y-6 dir-rtl font-sans" dir="rtl">
      {/* SUMMARY BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">داواکارییە هەڵپەسێردراوەکان</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{pendingCount} <span className="text-xs font-normal text-slate-500">داواکاری</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/70 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">کۆی بڕی هەڵپەسێردراو</p>
            <p className="text-2xl font-black font-mono text-slate-900 mt-1">{pendingTotalAmount.toLocaleString()} <span className="text-xs font-sans font-normal text-slate-500">IQD</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-emerald-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">سەرچاوەی داواکارییەکان</p>
            <p className="text-sm font-black text-slate-900 mt-1">بۆتی تەلەگرام & وێبسایت</p>
            <p className="text-[11px] text-slate-500 mt-0.5">پەسەندکردن ڕاستەوخۆ دەچێتە سەر خەرجی</p>
          </div>
          <button 
            type="button"
            onClick={loadRequests} 
            disabled={isLoading}
            className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/70 text-blue-600 hover:bg-blue-100 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
            title="نوێکردنەوە"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-slate-100/90 border border-slate-200/80 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2 text-slate-500 text-xs font-bold">
            <Filter className="w-3.5 h-3.5" />
            <span>دۆخ:</span>
          </div>
          
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              statusFilter === 'pending'
                ? 'bg-white text-amber-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>هەڵپەسێردراو ({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              statusFilter === 'approved'
                ? 'bg-white text-emerald-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>پەسەندکراو</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              statusFilter === 'rejected'
                ? 'bg-white text-rose-700 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>ڕەتکراوە</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-black'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            هەموو ({requests.length})
          </button>
        </div>

        <button
          type="button"
          onClick={loadRequests}
          disabled={isLoading}
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/60 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>نوێکردنەوەی خێرا</span>
        </button>
      </div>

      {/* LIST OF REQUESTS */}
      {filteredRequests.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Receipt className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-800">
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
              className={`p-5 bg-white rounded-3xl border transition-all flex flex-col justify-between shadow-xs hover:shadow-md ${
                req.status === 'pending'
                  ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/20 to-white'
                  : req.status === 'approved'
                  ? 'border-emerald-200/80'
                  : 'border-rose-200/80 opacity-75'
              }`}
            >
              <div className="space-y-4">
                {/* Header: Employee & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-sm border border-slate-200/60">
                      {req.employeeName.slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 leading-tight">
                        {req.employeeName}
                      </h4>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        کۆد: {req.employeeId}
                      </p>
                    </div>
                  </div>

                  <div>
                    {req.status === 'pending' && (
                      <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200/80 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" />
                        هەڵپەسێردراو
                      </span>
                    )}
                    {req.status === 'approved' && (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200/80 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        پەسەندکراو
                      </span>
                    )}
                    {req.status === 'rejected' && (
                      <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200/80 flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-rose-500" />
                        ڕەتکراوە
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount & Category */}
                <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">بڕی پارە</span>
                    <span className="text-lg font-black font-mono text-slate-900">
                      {req.amount.toLocaleString()} <span className="text-xs font-sans text-slate-500">دینار</span>
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-slate-500 block">جۆری مەسروف</span>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg inline-block border border-blue-200/60">
                      {req.category}
                    </span>
                  </div>
                </div>

                {/* Transport Route if available */}
                {(req.route || req.from || req.to) && (
                  <div className="p-2.5 bg-blue-50/70 rounded-2xl border border-blue-200/60 space-y-1">
                    <span className="text-[11px] font-bold text-blue-600 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5" />
                      <span>هاتوچۆ و ڕێڕەو:</span>
                    </span>
                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>{req.from || '—'}</span>
                      <ArrowLeft className="w-3 h-3 text-slate-400 inline" />
                      <span>{req.to || '—'}</span>
                    </p>
                  </div>
                )}

                {/* Note / Reason */}
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">هۆکار و تێبینی:</span>
                  <p className="text-xs font-medium text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    {req.note || 'بەبێ تێبینی'}
                  </p>
                </div>

                {/* Receipt Photo Thumbnail (if available) */}
                {req.receiptPhotoUrl ? (
                  <div className="flex items-center justify-between p-2.5 bg-slate-100/60 rounded-2xl border border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-bold text-slate-700">وێنەی پسوولە هەیە</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedImage(req.receiptPhotoUrl!)}
                      className="px-3 py-1 bg-white hover:bg-slate-50 text-xs font-bold text-blue-600 rounded-xl border border-slate-200 flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>بینین</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                    <Camera className="w-3 h-3 text-slate-400" />
                    <span>بەبێ هاوپێچی پسوولە</span>
                  </p>
                )}

                {/* Date & Submitter Info */}
                <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-2 font-mono">
                  <span className="flex items-center gap-1 font-sans">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{req.dateStr}</span>
                  </span>
                  <span>{new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* Approval metadata */}
                {req.approvedBy && (
                  <div className="text-[11px] p-2 rounded-xl bg-slate-100 text-slate-600">
                    <span>بڕیاردەر: <b>{req.approvedBy}</b></span>
                    {req.rejectionReason && <p className="text-rose-600 mt-0.5">هۆکاری ڕەتکردنەوە: {req.rejectionReason}</p>}
                  </div>
                )}
              </div>

              {/* Actions for Pending Requests */}
              {req.status === 'pending' && (
                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleApprove(req)}
                    disabled={processingId === req.id}
                    className="w-full py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{processingId === req.id ? 'خەریکە...' : 'پەسەندکردن'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRejectModalReq(req);
                      setRejectReason('');
                    }}
                    disabled={processingId === req.id}
                    className="w-full py-2.5 px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>ڕەتکردنەوە</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* IMAGE PREVIEW MODAL */}
      {selectedImage && (
        <Dialog open={Boolean(selectedImage)} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-2xl dir-rtl p-4 bg-white rounded-3xl border border-slate-200 shadow-xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2 text-slate-900">
                <Receipt className="w-5 h-5 text-blue-600" />
                <span>وێنەی پسوولەی داواکراو</span>
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 flex items-center justify-center max-h-[70vh] overflow-hidden rounded-2xl bg-slate-50 border border-slate-200/60 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={selectedImage} 
                alt="Receipt" 
                className="max-h-[65vh] w-auto object-contain rounded-xl shadow-xs"
              />
            </div>
            <DialogFooter className="mt-4 flex justify-between items-center sm:justify-between">
              <a
                href={selectedImage}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>کردنەوە لە پەڕەیەکی نوێ</span>
              </a>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer active:scale-95"
              >
                داخستن
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* REJECT CONFIRMATION MODAL */}
      {rejectModalReq && (
        <Dialog open={Boolean(rejectModalReq)} onOpenChange={() => setRejectModalReq(null)}>
          <DialogContent className="max-w-md dir-rtl p-6 bg-white rounded-3xl border border-slate-200 shadow-xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>ڕەتکردنەوەی داواکاری مەسروفات</span>
              </DialogTitle>
            </DialogHeader>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                ئایا دڵنیایت لە ڕەتکردنەوەی داواکاری مەسروفاتی کارمەند <b className="text-slate-900">{rejectModalReq.employeeName}</b> بە بڕی <b className="text-slate-900 font-mono">{rejectModalReq.amount.toLocaleString()} دینار</b>؟
              </p>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  هۆکاری ڕەتکردنەوە (ئارەزوومەندانە):
                </label>
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="نموونە: پسوولە نادیارە، بڕەکە زۆرە..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                />
              </div>
            </div>
            <DialogFooter className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={processingId === rejectModalReq.id}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-xs"
              >
                {processingId === rejectModalReq.id ? 'خەریکە...' : 'بەڵێ، ڕەتی بکەرەوە'}
              </button>
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer active:scale-95"
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
