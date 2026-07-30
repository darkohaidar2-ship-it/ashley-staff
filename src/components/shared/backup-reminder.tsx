
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/app-provider';
import { Download, DatabaseBackup, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function BackupReminder() {
  const [isOpen, setIsOpen] = useState(false);
  const { exportStateAsJson, isLoading } = useAppContext();
  const { user } = useAuth();

  useEffect(() => {
    // SECURITY: Only show backup reminder to authenticated Administrators (non-anonymous)
    if (isLoading || !user || false) return;

    const lastBackup = localStorage.getItem('ashley_last_backup_date');
    const now = new Date().getTime();
    const lastTime = lastBackup ? new Date(lastBackup).getTime() : 0;
    
    // Cycle check: 24 hours (86,400,000 ms)
    if (now - lastTime >= 86400000) {
      const timer = setTimeout(() => setIsOpen(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, user]);

  const handleDismiss = () => {
    localStorage.setItem('ashley_last_backup_date', new Date().toISOString());
    setIsOpen(false);
  };

  const handleDownload = () => {
    exportStateAsJson();
    localStorage.setItem('ashley_last_backup_date', new Date().toISOString());
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed bottom-6 end-6 z-[9999] w-[400px] max-w-[calc(100vw-3rem)]",
        "animate-in slide-in-from-right-10 rtl:slide-in-from-left-10 fade-in duration-700 ease-out"
      )}
    >
      {/* Acrylic Glass Shell */}
      <div className="relative group overflow-hidden rounded-[28px] border border-border bg-card/60 backdrop-blur-3xl shadow-[0_20px_60px_rgba(0,0,0,0.12)] transition-all duration-500">
        
        {/* Animated Glow Backdrop */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/10 blur-[60px] pointer-events-none group-hover:bg-primary/20 transition-all duration-700" />
        
        {/* Subtle Header Accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-60" />

        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/80 to-primary text-primary-foreground shadow-xl shadow-primary/20 ring-4 ring-primary/5 transition-transform group-hover:scale-110 duration-500">
                  <DatabaseBackup className="w-6 h-6" />
                </div>
                {/* Status Dot */}
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-[3px] border-card shadow-sm" />
              </div>
              
              <div className="space-y-0.5" dir="rtl">
                <h3 className="text-[13px] font-black uppercase tracking-[0.15em] text-foreground leading-none text-right">
                  هاوکاتکردنی داتا / پاشەکەوت
                </h3>
                <div className="flex items-center gap-1.5 opacity-60 justify-start">
                   <ShieldCheck className="w-3 h-3 text-primary" />
                   <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">پرۆتۆکۆلی پاراستن چالاکە</span>
                </div>
              </div>
            </div>

            <button 
              onClick={handleDismiss}
              className="group/close p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all text-muted-foreground hover:text-foreground active:scale-90"
            >
              <X className="w-4 h-4 transition-transform group-hover/close:rotate-90" />
            </button>
          </div>

          <div className="mt-6 space-y-4" dir="rtl">
            <div className="p-4 rounded-2xl bg-white/5 border border-border shadow-inner">
              <p className="text-[14px] font-semibold text-muted-foreground leading-[1.6] text-right">
                سیستەمی نێکسیوس پێویستی بە فایلی پاشەکەوتی ناوخۆیی هەیە. ئەمە بەردەوامی و سەلامەتی داتاکانی کۆگاکەت دەستەبەر دەکات.
              </p>
            </div>
            
            <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3">
               <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
               <p className="text-[12.5px] font-black text-primary leading-relaxed text-right w-full">
                  پاشەکەوتی ڕۆژانە دڵنیایی دەدات کە هەموو زانیارییەکانت بە سەلامەتی دەمێننەوە.
               </p>
            </div>
          </div>

          <div className="mt-8 flex gap-3" dir="rtl">
            <Button 
              variant="ghost" 
              onClick={handleDismiss}
              className="flex-1 bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 h-11 rounded-[14px] border border-transparent hover:border-white/10 transition-all text-muted-foreground"
            >
              دواتر بیپشکنە
            </Button>
            <Button 
              onClick={handleDownload}
              className={cn(
                "flex-[1.8] bg-primary hover:bg-primary/80 text-primary-foreground text-[10px] font-black uppercase tracking-widest h-11 rounded-[14px] transition-all",
                "shadow-[0_10px_25px_-5px_rgba(var(--primary),0.4)]",
                "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              )}
            >
              <Download className="w-4 h-4 ml-2.5 shrink-0" />
              هاوکاتکردنی پاشەکەوت
            </Button>
          </div>
        </div>

        {/* Glossy Overlay Reflect */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50" />
      </div>
    </div>
  );
}
