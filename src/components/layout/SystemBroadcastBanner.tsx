'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Megaphone, X, Clock, User, CheckCircle2 } from 'lucide-react';

interface Announcement {
  id: string;
  senderName: string;
  senderId?: string;
  text: string;
  photoUrl?: string | null;
  createdAt: string;
  dateStr: string;
  timeStr: string;
}

export function SystemBroadcastBanner() {
  const [latestAnnouncement, setLatestAnnouncement] = useState<Announcement | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Check local storage for dismissed announcement
    const dismissed = localStorage.getItem('ashley_dismissed_announcement');
    if (dismissed) {
      setDismissedId(dismissed);
    }

    async function loadLatest() {
      try {
        const { data, error } = await supabase
          .from('warehouses')
          .select('qr_code')
          .eq('id', 'ashley_system_announcements')
          .maybeSingle();

        if (data?.qr_code) {
          const list: Announcement[] = typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
          if (Array.isArray(list) && list.length > 0) {
            const latest = list[0];
            // Check if within last 48 hours
            const ageHours = (Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60);
            if (ageHours < 48) {
              setLatestAnnouncement(latest);
            }
          }
        }
      } catch (e) {
        // silent
      }
    }

    loadLatest();

    // Check periodically every 60 seconds
    const interval = setInterval(loadLatest, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!latestAnnouncement || latestAnnouncement.id === dismissedId) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem('ashley_dismissed_announcement', latestAnnouncement.id);
    setDismissedId(latestAnnouncement.id);
  };

  return (
    <>
      {/* Top Floating Notification Banner */}
      <div 
        className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-xs z-50 print:hidden animate-fade-in"
        dir="rtl"
      >
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => setModalOpen(true)}>
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
            <Megaphone className="w-3.5 h-3.5 text-white" />
          </div>

          <div className="flex items-center gap-2 truncate">
            <span className="font-black bg-white/20 px-2 py-0.5 rounded-full text-[10px] shrink-0">
              ئاگاداری گشتی لەلایەن {latestAnnouncement.senderName}
            </span>
            <span className="font-medium truncate opacity-95">
              {latestAnnouncement.text}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 mr-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-[11px] underline font-bold hover:text-white/80 transition-all cursor-pointer"
          >
            بینینی تەواو
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/30 flex items-center justify-center text-white transition-all cursor-pointer"
            title="داخستن"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal with Full Announcement Details */}
      {modalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden"
          dir="rtl"
          onClick={() => setModalOpen(false)}
        >
          <div 
            className="bg-white dark:bg-[#1c1c1e] max-w-lg w-full rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    ئاگاداری فەرمی لە بەڕێوەبەرایەتی ئاشڵی
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span>{latestAnnouncement.dateStr}</span>
                    <span>•</span>
                    <span>{latestAnnouncement.timeStr}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-xs text-slate-700 dark:text-slate-300 font-bold">
              <User className="w-4 h-4 text-[#007AFF]" />
              <span>ئاگادارکردنەوە لەلایەن بەڕێز: <b>{latestAnnouncement.senderName}</b></span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#242426] border border-slate-200/60 dark:border-white/5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {latestAnnouncement.text}
            </div>

            {latestAnnouncement.photoUrl && (
              <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10">
                <img 
                  src={latestAnnouncement.photoUrl} 
                  alt="وێنەی ئاگاداری" 
                  className="w-full max-h-72 object-contain bg-black/5" 
                />
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  handleDismiss();
                  setModalOpen(false);
                }}
                className="px-5 py-2 rounded-2xl bg-[#007AFF] hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                تێگەیشتم و داخستن
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
