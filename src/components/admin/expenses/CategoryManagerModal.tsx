'use client';

import React from 'react';
import { 
  Settings, 
  X, 
  Tag, 
  Sparkles, 
  RotateCcw, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  Save 
} from 'lucide-react';

interface CategoryItem {
  key: string;
  label: string;
  color?: string;
}

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  presetReasons: Record<string, string[]>;
  activeTab: 'categories' | 'reasons';
  setActiveTab: (tab: 'categories' | 'reasons') => void;
  selectedCatKey: string;
  setSelectedCatKey: (key: string) => void;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  editingCategoryKey: string | null;
  setEditingCategoryKey: (key: string | null) => void;
  editingCategoryLabel: string;
  setEditingCategoryLabel: (label: string) => void;
  newReasonText: string;
  setNewReasonText: (text: string) => void;
  editingReasonIndex: number | null;
  setEditingReasonIndex: (index: number | null) => void;
  editingReasonText: string;
  setEditingReasonText: (text: string) => void;
  onAddCategory: (e?: React.FormEvent) => void;
  onSaveEditCategory: (key: string) => void;
  onDeleteCategory: (key: string) => void;
  onAddReason: (e?: React.FormEvent) => void;
  onSaveEditReason: (catKey: string, index: number) => void;
  onDeleteReason: (catKey: string, index: number) => void;
  onResetDefaults: () => void;
}

export function CategoryManagerModal({
  isOpen,
  onClose,
  categories,
  presetReasons,
  activeTab,
  setActiveTab,
  selectedCatKey,
  setSelectedCatKey,
  newCategoryName,
  setNewCategoryName,
  editingCategoryKey,
  setEditingCategoryKey,
  editingCategoryLabel,
  setEditingCategoryLabel,
  newReasonText,
  setNewReasonText,
  editingReasonIndex,
  setEditingReasonIndex,
  editingReasonText,
  setEditingReasonText,
  onAddCategory,
  onSaveEditCategory,
  onDeleteCategory,
  onAddReason,
  onSaveEditReason,
  onDeleteReason,
  onResetDefaults,
}: CategoryManagerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 font-sans" dir="rtl">
      <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50/80 dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                بەڕێوەبردنی پۆلێن و تێبینییەکان (Cloud Synced)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                زیادکردن، گۆڕین و سڕینەوەی پۆلێنەکانی مەسروفات و دەقەکانی پێشنیار
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              setEditingCategoryKey(null);
              setEditingReasonIndex(null);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Categories vs Notes) */}
        <div className="p-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/40 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2 p-1 bg-slate-200/70 dark:bg-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('categories');
                setEditingCategoryKey(null);
                setEditingReasonIndex(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'categories'
                  ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>پۆلێنەکانی خەرجی ({categories.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('reasons');
                setEditingCategoryKey(null);
                setEditingReasonIndex(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'reasons'
                  ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>تێبینی و هۆکارە پێشوەختەکان</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: CATEGORIES CRUD */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              {/* Add New Category Form */}
              <form onSubmit={onAddCategory} className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="ناوی پۆلێنی نوێ بنووسە (بۆ نموونە: گەیاندن، بەنزین...)"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!newCategoryName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>زیادکردن</span>
                </button>
              </form>

              {/* Categories List */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  پێڕستی هەموو پۆلێنە بەردەستەکان:
                </span>
                <div className="divide-y divide-slate-100 dark:divide-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-white/[0.02]">
                  {categories.map((cat) => {
                    const isEditing = editingCategoryKey === cat.key;
                    const reasonsCount = (presetReasons[cat.key] || []).length;
                    return (
                      <div key={cat.key} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingCategoryLabel}
                              onChange={(e) => setEditingCategoryLabel(e.target.value)}
                              className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-blue-400 bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => onSaveEditCategory(cat.key)}
                              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                              title="پاشەکەوتکردن"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCategoryKey(null)}
                              className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer"
                              title="پەشیمانبوونەوە"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {cat.label}
                              </span>
                              <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-full shrink-0">
                                {reasonsCount} تێبینی
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCatKey(cat.key);
                                  setActiveTab('reasons');
                                }}
                                className="px-2 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                                title="دەستکاریکردنی تێبینییەکانی ئەم پۆلێنە"
                              >
                                تێبینییەکان ⬅️
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategoryKey(cat.key);
                                  setEditingCategoryLabel(cat.label);
                                }}
                                className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors cursor-pointer"
                                title="گۆڕینی ناوی ئەم پۆلێنە"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteCategory(cat.key)}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                title="سڕینەوەی ئەم پۆلێنە"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRESET REASONS / NOTES CRUD */}
          {activeTab === 'reasons' && (
            <div className="space-y-4">
              {/* Category Selector Pill */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  ئەو پۆلێنە هەڵبژێرە کە دەتەوێت تێبینی بۆ زیاد یان کەم بکەیت:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setSelectedCatKey(c.key);
                        setEditingReasonIndex(null);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedCatKey === c.key
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {c.label} ({(presetReasons[c.key] || []).length})
                    </button>
                  ))}
                </div>
              </div>

              {/* Add New Reason Form */}
              <form onSubmit={onAddReason} className="flex gap-2">
                <input
                  type="text"
                  value={newReasonText}
                  onChange={(e) => setNewReasonText(e.target.value)}
                  placeholder={`تێبینی نوێ بۆ پۆلێنی (${categories.find(c => c.key === selectedCatKey)?.label || ''}) بنووسە...`}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!newReasonText.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>زیادکردن</span>
                </button>
              </form>

              {/* Preset Reasons List */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  تێبینییە خێرا بەردەستەکان بۆ «{categories.find(c => c.key === selectedCatKey)?.label}»:
                </span>
                {(!presetReasons[selectedCatKey] || presetReasons[selectedCatKey].length === 0) ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                    هیچ تێبینییەکی ئامادەکراو بۆ ئەم پۆلێنە نییە. فۆڕمەکەی سەرەوە بەکاربهێنە بۆ زیادکردن.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-white/[0.02]">
                    {presetReasons[selectedCatKey].map((reason, index) => {
                      const isEditing = editingReasonIndex === index;
                      return (
                        <div key={index} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editingReasonText}
                                onChange={(e) => setEditingReasonText(e.target.value)}
                                className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-blue-400 bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => onSaveEditReason(selectedCatKey, index)}
                                className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                title="پاشەکەوتکردن"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingReasonIndex(null)}
                                className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer"
                                title="پەشیمانبوونەوە"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                                {reason}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingReasonIndex(index);
                                    setEditingReasonText(reason);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors cursor-pointer"
                                  title="دەستکاریکردن"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteReason(selectedCatKey, index)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                  title="سڕینەوە"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onResetDefaults}
            className="text-[11px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>گەڕانەوە بۆ ڕێکخستنی بنەڕەتی سیستەم</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              setEditingCategoryKey(null);
              setEditingReasonIndex(null);
            }}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            داخستن
          </button>
        </div>
      </div>
    </div>
  );
}
