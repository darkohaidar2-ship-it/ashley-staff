'use client';

import React, { useState } from 'react';
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
  Save,
  Navigation,
  MapPin,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import type { CustomRouteItem } from '@/lib/supabase/expenses/expenses-service';

interface CategoryItem {
  key: string;
  label: string;
  color?: string;
}

export type ManagerTabType = 'categories' | 'reasons' | 'routes';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  presetReasons: Record<string, string[]>;
  activeTab: ManagerTabType;
  setActiveTab: (tab: ManagerTabType) => void;
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
  // 🚕 Transport Routes Props
  customRoutes: CustomRouteItem[];
  onAddRoute: (from: string, to: string) => void;
  onSaveEditRoute: (id: string, from: string, to: string) => void;
  onDeleteRoute: (id: string) => void;
  onResetRoutes: () => void;
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
  customRoutes = [],
  onAddRoute,
  onSaveEditRoute,
  onDeleteRoute,
  onResetRoutes,
}: CategoryManagerModalProps) {
  // Local state for adding and editing routes
  const [routeFromInput, setRouteFromInput] = useState('');
  const [routeToInput, setRouteToInput] = useState('');
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingRouteFrom, setEditingRouteFrom] = useState('');
  const [editingRouteTo, setEditingRouteTo] = useState('');

  if (!isOpen) return null;

  const handleRouteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeFromInput.trim() || !routeToInput.trim()) return;
    onAddRoute(routeFromInput.trim(), routeToInput.trim());
    setRouteFromInput('');
    setRouteToInput('');
  };

  const handleRouteSaveEdit = (id: string) => {
    if (!editingRouteFrom.trim() || !editingRouteTo.trim()) return;
    onSaveEditRoute(id, editingRouteFrom.trim(), editingRouteTo.trim());
    setEditingRouteId(null);
  };

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
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>بەڕێوەبردنی تێبینی و هێڵەکان</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
                  Cloud & Telegram Synced ⚡
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                هەر گۆڕانکارییەک لێرە بیکەیت ڕاستەوخۆ و ئۆتۆماتیکی لە بۆتی تەلەگرامیش کارا دەبێت
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              setEditingCategoryKey(null);
              setEditingReasonIndex(null);
              setEditingRouteId(null);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (3 Tabs: Categories, Notes/Reasons, Routes) */}
        <div className="p-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/40 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('reasons');
                setEditingCategoryKey(null);
                setEditingReasonIndex(null);
                setEditingRouteId(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'reasons'
                  ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>تێبینی و هۆکارەکان</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('routes');
                setEditingCategoryKey(null);
                setEditingReasonIndex(null);
                setEditingRouteId(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'routes'
                  ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>هێڵەکانی هاتوچۆ ({customRoutes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('categories');
                setEditingCategoryKey(null);
                setEditingReasonIndex(null);
                setEditingRouteId(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'categories'
                  ? 'bg-white dark:bg-[#2c2c2e] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>پۆلێنەکانی خەرجی ({categories.length})</span>
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
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {cat.label}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                ({reasonsCount} تێبینی خەزنکراو)
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategoryKey(cat.key);
                                  setEditingCategoryLabel(cat.label);
                                }}
                                className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors cursor-pointer"
                                title="دەستکاریکردنی ناوی پۆلێن"
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

          {/* TAB 2: PRESET REASONS / NOTES CRUD (Includes Overtime) */}
          {activeTab === 'reasons' && (
            <div className="space-y-4">
              {/* Category Selector Pill */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  ئەو بەشە هەڵبژێرە کە دەتەوێت تێبینی بۆ زیاد، دەستکاری یان کەم بکەیت:
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
                  placeholder={`تێبینی نوێ بۆ (${categories.find(c => c.key === selectedCatKey)?.label || ''}) بنووسە...`}
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
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    تێبینییە خێراکان بۆ «{categories.find(c => c.key === selectedCatKey)?.label}»:
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    باشترین ٥ تێبینی دەچنە سەرەوەی تەلەگرام بۆت
                  </span>
                </div>
                {(!presetReasons[selectedCatKey] || presetReasons[selectedCatKey].length === 0) ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                    هیچ تێبینییەکی ئامادەکراو بۆ ئەم بەشە نییە. فۆڕمەکەی سەرەوە بەکاربهێنە بۆ زیادکردن.
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
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/10 text-[10px] font-bold text-slate-500 flex items-center justify-center">
                                  {index + 1}
                                </span>
                                <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                                  {reason}
                                </span>
                              </div>
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

          {/* TAB 3: TRANSPORT ROUTES (لە کوێوە بۆ کوێ) CRUD */}
          {activeTab === 'routes' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                💡 <b>هێڵەکانی هاتوچۆ و تەکسی:</b> لێرە دەتوانیت دیاری بکەیت کارمەندان لە کوێوە بۆ کوێ بچن (لە ⬅️ بۆ). ئەم هێڵانە دەستبەجێ و ئۆتۆماتیکی لە تەلەگرام بۆتیش بە دوگمە دەردەکەون!
              </div>

              {/* Add Route Form: [لە: دەستپێک] ⬅️ [بۆ: مەبەست] */}
              <form onSubmit={handleRouteSubmit} className="space-y-2 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                  زیادکردنی هێڵی نوێی هاتوچۆ:
                </span>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      value={routeFromInput}
                      onChange={(e) => setRouteFromInput(e.target.value)}
                      placeholder="لە: شوێنی دەستپێک (نموونە: کۆگای هوانە)"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="text-slate-400 font-bold shrink-0">⬅️</div>
                  <div className="flex-1 w-full">
                    <input
                      type="text"
                      value={routeToInput}
                      onChange={(e) => setRouteToInput(e.target.value)}
                      placeholder="بۆ: شوێنی مەبەست (نموونە: پێشانگا)"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#2c2c2e] focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!routeFromInput.trim() || !routeToInput.trim()}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>زیادکردن</span>
                  </button>
                </div>
              </form>

              {/* Routes List */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  پێڕستی هێڵە چالاکەکان ({customRoutes.length}):
                </span>
                {customRoutes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                    هیچ هێڵێکی هاتوچۆ تۆمار نەکراوە. فۆڕمەکەی سەرەوە بەکاربهێنە.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/5 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-white/[0.02]">
                    {customRoutes.map((r, index) => {
                      const isEditing = editingRouteId === r.id;
                      return (
                        <div key={r.id || index} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                          {isEditing ? (
                            <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 w-full">
                              <input
                                type="text"
                                value={editingRouteFrom}
                                onChange={(e) => setEditingRouteFrom(e.target.value)}
                                placeholder="لە..."
                                className="flex-1 w-full px-2.5 py-1 text-xs rounded-lg border border-blue-400 bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white"
                              />
                              <span className="text-slate-400">⬅️</span>
                              <input
                                type="text"
                                value={editingRouteTo}
                                onChange={(e) => setEditingRouteTo(e.target.value)}
                                placeholder="بۆ..."
                                className="flex-1 w-full px-2.5 py-1 text-xs rounded-lg border border-blue-400 bg-white dark:bg-[#2c2c2e] text-slate-900 dark:text-white"
                              />
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleRouteSaveEdit(r.id)}
                                  className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                  title="پاشەکەوتکردن"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRouteId(null)}
                                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300 transition-colors cursor-pointer"
                                  title="پەشیمانبوونەوە"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center shrink-0">
                                  🚕
                                </span>
                                <div>
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    لە: <span className="text-blue-600 dark:text-blue-400 font-black">{r.from}</span> ⬅️ بۆ: <span className="text-emerald-600 dark:text-emerald-400 font-black">{r.to}</span>
                                  </span>
                                  {r.label && (
                                    <span className="text-[10px] text-slate-400 block font-normal">
                                      دوگمەی تەلەگرام: {r.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRouteId(r.id);
                                    setEditingRouteFrom(r.from);
                                    setEditingRouteTo(r.to);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-lg transition-colors cursor-pointer"
                                  title="دەستکاریکردنی ئەم هێڵە"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteRoute(r.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                                  title="سڕینەوەی ئەم هێڵە"
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
            onClick={activeTab === 'routes' ? onResetRoutes : onResetDefaults}
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
              setEditingRouteId(null);
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
