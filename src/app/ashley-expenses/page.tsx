'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Loader2, DollarSign } from 'lucide-react';
import withAuth from '@/hooks/withAuth';
import { useAppContext } from '@/context/app-provider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AdminExpensesModule } from '@/components/admin/AdminExpensesModule';

function AshleyExpensesDashboard() {
  const { employees, settings, setSettings } = useAppContext();
  const { toast } = useToast();

  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [salaryRates, setSalaryRates] = useState({
    overtimeRate: settings?.salarySettings?.overtimeRate ?? 5000,
    bonusRate: settings?.salarySettings?.bonusRate ?? 5000,
  });
  const [isSavingRates, setIsSavingRates] = useState(false);

  useEffect(() => {
    if (settings?.salarySettings) {
      setSalaryRates({
        overtimeRate: settings.salarySettings.overtimeRate ?? 5000,
        bonusRate: settings.salarySettings.bonusRate ?? 5000,
      });
    }
  }, [settings?.salarySettings]);

  const handleSaveSalaryRates = () => {
    setIsSavingRates(true);
    setSettings({
      ...settings,
      salarySettings: salaryRates,
    });
    toast({
      title: 'ڕێکخستنەکان پاشەکەوت کران',
      description: 'نرخی کاتژمێری زیادە و پاداشت نوێکرایەوە.',
    });
    setIsSavingRates(false);
    setIsSalaryModalOpen(false);
  };

  return (
    <div className="w-full bg-[#f8fafc] font-sans p-4 sm:p-6 lg:p-8 dir-rtl min-h-screen text-slate-900" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header with Salary Rates Quick Access */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              بەڕێوەبردنی مەسروفات، پاداشت و پێشینە
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              سیستەمی گشتگیری کۆنترۆڵی خەرجییەکان، پسوولە و تۆماری دارایی
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsSalaryModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span>ڕێکخستنی نرخی زیادە و پاداشت</span>
          </button>
        </div>

        {/* Primary Apple-Style Expenses Module & Live Preview */}
        <AdminExpensesModule employees={employees} />

        {/* Salary Settings Dialog */}
        <Dialog open={isSalaryModalOpen} onOpenChange={setIsSalaryModalOpen}>
          <DialogContent className="max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 dir-rtl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                ڕێکخستنی نرخی مووچە و کاتی زیادە
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                دیاریکردنی نرخی کاتژمێری زیادە و پاداشت بە دیناری عێراقی (IQD).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="overtime-rate" className="text-xs font-bold text-slate-700">
                  نرخی کاتژمێری زیادە (IQD / کاتژمێر)
                </Label>
                <Input
                  id="overtime-rate"
                  type="number"
                  value={salaryRates.overtimeRate}
                  onChange={(e) => setSalaryRates(prev => ({ ...prev, overtimeRate: e.target.valueAsNumber || 0 }))}
                  placeholder="5000"
                  className="h-10 text-sm font-mono rounded-xl bg-slate-50 border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bonus-rate" className="text-xs font-bold text-slate-700">
                  نرخی پاداشت بۆ هەر بارکردن (IQD)
                </Label>
                <Input
                  id="bonus-rate"
                  type="number"
                  value={salaryRates.bonusRate}
                  onChange={(e) => setSalaryRates(prev => ({ ...prev, bonusRate: e.target.valueAsNumber || 0 }))}
                  placeholder="5000"
                  className="h-10 text-sm font-mono rounded-xl bg-slate-50 border-slate-200"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <button 
                type="button" 
                onClick={() => setIsSalaryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-all"
              >
                پاشگەزبوونەوە
              </button>
              <button 
                type="button" 
                onClick={handleSaveSalaryRates} 
                disabled={isSavingRates}
                className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
              >
                {isSavingRates ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                <span>پاشەکەوتکردن</span>
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

export default withAuth(AshleyExpensesDashboard);
