'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Receipt, 
  Camera, 
  Upload, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Loader2, 
  ChevronDown, 
  Image as ImageIcon,
  DollarSign
} from 'lucide-react';
import { MobileAuthUser } from './types';

interface ExpensesTabProps {
  user: MobileAuthUser;
}

interface ExpenseItem {
  id: string;
  amount: number;
  category: string;
  note: string;
  dateStr: string;
  status: 'pending' | 'approved' | 'rejected';
  receiptPhotoUrl?: string;
  createdAt?: string;
}

const CATEGORY_CHIPS = [
  { label: 'بەنزین و سووتەمەنی', icon: '⛽' },
  { label: 'تەکسی و هاتوچۆ', icon: '🚕' },
  { label: 'کڕینی کەلوپەل', icon: '🛠️' },
  { label: 'خواردن و میوانداری', icon: '🥪' },
  { label: 'چاککردنەوە', icon: '🔧' },
  { label: 'مەکتەب و ئۆفیس', icon: '🏢' },
  { label: 'گشتی', icon: '📁' },
];

export function ExpensesTab({ user }: ExpensesTabProps) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form State
  const [amountInput, setAmountInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORY_CHIPS[0].label);
  const [noteInput, setNoteInput] = useState('');
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Expanded Image Modal
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user expenses
  const loadExpenses = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/mobile/expense?employeeId=${encodeURIComponent(user.employeeId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.expenses)) {
        setExpenses(data.expenses);
      }
    } catch (err) {
      console.error('[ExpensesTab] Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [user.employeeId]);

  // Handle Photo Capture & Compression
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress image via Canvas to max 1200px
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.78);
          setReceiptBase64(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Submit Expense Request
  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawAmount = parseInt(amountInput.replace(/[^\d]/g, ''), 10);
    if (isNaN(rawAmount) || rawAmount <= 0) {
      setFeedback({ type: 'error', message: 'تکایە بڕی پارەی ڕاست بنووسە' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/mobile/expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user.employeeId,
          employeeName: user.employeeName,
          amount: rawAmount,
          category: selectedCategory,
          note: noteInput.trim(),
          receiptPhotoUrl: receiptBase64 || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({ type: 'success', message: 'داواکاری مەسروفاتەکەت تۆمارکرا و ڕەوانەی بەڕێوەبەرایەتی کرا.' });
        setAmountInput('');
        setNoteInput('');
        setReceiptBase64(null);
        setShowCreateForm(false);
        loadExpenses();
      } else {
        setFeedback({ type: 'error', message: data.error || 'هەڵەیەک ڕوویدا لە تۆمارکردنی مەسروفات' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'هەڵەی پەیوەندی بە سێرڤەر' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>💸</span> داواکردنی مەسروفات
          </h2>
          <p className="text-[11px] text-slate-400">
            تۆمارکردنی خەرجی و پسوڵەکانی تایبەت بە کار
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setFeedback(null);
          }}
          className="h-10 px-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>داواکاری نوێ</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
          feedback.type === 'success'
            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Expense Submission Form */}
      {showCreateForm && (
        <form onSubmit={handleSubmitExpense} className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              تۆمارکردنی پسوڵە و خەرجی نوێ
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-[11px] text-slate-300 font-medium mb-1.5">
              بڕی پارە (دیناری عێراقی):
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={amountInput}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^\d]/g, '');
                  if (!cleaned) {
                    setAmountInput('');
                  } else {
                    setAmountInput(parseInt(cleaned, 10).toLocaleString('en-US'));
                  }
                }}
                placeholder="25,000"
                className="w-full h-12 bg-slate-900 border border-slate-700 rounded-2xl px-4 text-left font-mono text-base font-bold text-white focus:outline-none focus:border-amber-400"
                required
              />
              <span className="absolute right-3.5 top-3.5 text-xs text-slate-400 font-sans">
                د.ع
              </span>
            </div>
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-[11px] text-slate-300 font-medium mb-1.5">
              جۆری مەسروفات:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_CHIPS.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => setSelectedCategory(cat.label)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1 ${
                    selectedCategory === cat.label
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md'
                      : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-[11px] text-slate-300 font-medium mb-1.5">
              هۆکار و تێبینی:
            </label>
            <textarea
              rows={2}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="بۆ نموونە: کڕینی بەنزین بۆ ئۆتۆمبێلی کۆگا لە گەشتی هەولێر..."
              className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Receipt Photo Upload */}
          <div>
            <label className="block text-[11px] text-slate-300 font-medium mb-1.5">
              وێنەی پسوڵە (وەسڵ):
            </label>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {receiptBase64 ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-700 w-full h-36 bg-slate-950 flex items-center justify-center">
                <img
                  src={receiptBase64}
                  alt="Receipt Preview"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setReceiptBase64(null)}
                  className="absolute top-2 left-2 p-1.5 bg-black/70 hover:bg-black text-rose-400 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-20 border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-amber-400 transition-colors bg-slate-900/50"
              >
                <Camera className="w-5 h-5" />
                <span className="text-[11px] font-medium">گرتنی وێنەی پسوڵە لە کامێرا یان گەلەری</span>
              </button>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-12 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ناردنی داواکاری مەسروفات</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 h-12 bg-slate-700 text-slate-300 rounded-2xl text-xs font-medium"
            >
              داخستن
            </button>
          </div>
        </form>
      )}

      {/* Expenses History List */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-400 px-1">
          مێژووی داواکارییەکانی مەسروفات
        </h3>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            <span className="text-xs">بارکردنی مەسروفاتەکان...</span>
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-12 bg-slate-800/40 border border-slate-800 rounded-3xl text-center text-slate-500 text-xs">
            هیچ مەسروفاتێک تۆمار نەکراوە تا ئێستا.
          </div>
        ) : (
          expenses.map((exp) => (
            <div
              key={exp.id}
              className="p-4 bg-slate-800/80 border border-slate-700/60 rounded-2xl shadow-sm flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                {exp.receiptPhotoUrl ? (
                  <div
                    onClick={() => setPreviewPhoto(exp.receiptPhotoUrl!)}
                    className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden cursor-pointer hover:opacity-80 shrink-0"
                  >
                    <img src={exp.receiptPhotoUrl} alt="Receipt" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-center text-slate-500 shrink-0">
                    <Receipt className="w-6 h-6 text-slate-400" />
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold font-mono text-white">
                      {Number(exp.amount).toLocaleString('en-US')} د.ع
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 font-medium">
                      {exp.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1">
                    {exp.note || 'بێ تێبینی'}
                  </p>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {exp.dateStr}
                  </span>
                </div>
              </div>

              <div>
                {exp.status === 'approved' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-xl">
                    <CheckCircle2 className="w-3 h-3" />
                    پەسەندکراو
                  </span>
                ) : exp.status === 'rejected' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-xl">
                    <X className="w-3 h-3" />
                    ڕەتکراوە
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-xl">
                    <Clock className="w-3 h-3" />
                    چاوەڕوان
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div 
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-lg max-h-[85vh]">
            <img src={previewPhoto} alt="Full Receipt" className="rounded-2xl max-h-[85vh] object-contain shadow-2xl" />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-2 left-2 p-2 bg-black/70 text-white rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
