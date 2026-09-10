
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar as CalendarIcon, Printer, DollarSign, Clock, Gift, Banknote, FileText, Settings, FileDown, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardHeader, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';
import withAuth from '@/hooks/withAuth';
import { useAppContext } from '@/context/app-provider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ReportWrapper } from '@/components/reports/ReportWrapper';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { AdminExpensesModule } from '@/components/admin/AdminExpensesModule';
import * as XLSX from 'xlsx';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'IQD',
    maximumFractionDigits: 0,
  }).format(amount);
};

function AshleyExpensesDashboard() {
  const { t, language } = useTranslation();
  const { employees, expenses, overtime, bonuses, withdrawals, settings, setSettings } = useAppContext();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const isRTL = language === 'ku';

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
      title: isRTL ? 'ڕێکخستنەکان پاشەکەوت کران' : 'Settings Saved',
      description: isRTL ? 'نرخی کاتژمێری زیادە و پاداشت نوێکرایەوە.' : 'Salary rates updated successfully.',
    });
    setIsSavingRates(false);
    setIsSalaryModalOpen(false);
  };
  
  const menuItems = [
    { title: t('expenses'), icon: DollarSign, href: '/expenses', color: 'bg-blue-500' },
    { title: t('overtime'), icon: Clock, href: '/overtime', color: 'bg-orange-500' },
    { title: t('bonuses'), icon: Gift, href: '/bonuses', color: 'bg-green-500' },
    { title: t('cash_withdrawals'), icon: Banknote, href: '/cash-withdrawal', color: 'bg-rose-500' },
    { title: t('monthly_reports'), icon: FileText, href: '/monthly-report', color: 'bg-indigo-500' },
    { title: t('settings'), icon: Settings, onClick: () => setIsSalaryModalOpen(true), color: 'bg-gray-500' },
  ];

  const monthlyTotals = useMemo(() => {
    if (!selectedDate) return { expenses: 0, overtime: 0, bonuses: 0, withdrawals: 0 };
    
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);

    const filterAndSum = (data: any[], amountField: string) => {
        return data.filter(d => d.date && isWithinInterval(parseISO(d.date), { start, end }))
                   .reduce((sum, item) => sum + (item[amountField] || 0), 0);
    }
    
    return {
        expenses: filterAndSum(expenses, 'amount'),
        overtime: filterAndSum(overtime, 'totalAmount'),
        bonuses: filterAndSum(bonuses, 'totalAmount'),
        withdrawals: filterAndSum(withdrawals, 'amount'),
    }
  }, [selectedDate, expenses, overtime, bonuses, withdrawals]);
  
  const chartData = [
      { name: t('expenses'), total: monthlyTotals.expenses, fill: settings.pdfSettings.report.reportColors?.expense || 'hsl(var(--chart-1))' },
      { name: t('overtime'), total: monthlyTotals.overtime, fill: settings.pdfSettings.report.reportColors?.overtime || 'hsl(var(--chart-2))' },
      { name: t('bonuses'), total: monthlyTotals.bonuses, fill: settings.pdfSettings.report.reportColors?.bonus || 'hsl(var(--chart-3))' },
      { name: t('cash_withdrawals'), total: monthlyTotals.withdrawals, fill: settings.pdfSettings.report.reportColors?.withdrawal || 'hsl(var(--chart-4))' },
  ];
  
  const grandTotal = chartData.reduce((sum, item) => sum + item.total, 0);

  const handlePrint = () => window.print();

  const handleExportExcel = () => {
    const dataToExport = chartData.map(item => ({
      [isRTL ? 'پۆل' : 'Category']: item.name,
      [isRTL ? 'کۆی گشتی بڕ' : 'Total Amount']: item.total,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isRTL ? "تێڕوانینی گشتی مانگانە" : "Monthly Overview");
    XLSX.writeFile(workbook, `Ashley_Expenses_Overview_${format(selectedDate || new Date(), 'yyyy-MM')}.xlsx`);
  };

  const DashboardContent = () => (
    <Card className="border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm rounded-xl">
      <CardHeader className="py-3 px-4 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-wider">{t('monthly_overview')}</CardTitle>
          <div className='flex items-center gap-2 print:hidden'>
              <Button onClick={handlePrint} variant="outline" size="icon" className="h-8 w-8"><Printer className="h-3.5 w-3.5"/></Button>
              <Button onClick={handleExportExcel} variant="outline" size="icon" className="h-8 w-8"><FileDown className="h-3.5 w-3.5"/></Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-40 h-8 text-[10px] font-black justify-start text-left", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {selectedDate ? format(selectedDate, "MMMM yyyy") : <span>{t('pick_a_month')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} captionLayout="dropdown" fromYear={2020} toYear={2040} />
                </PopoverContent>
              </Popover>
          </div>
      </CardHeader>
      <CardContent className="p-4">
          {grandTotal > 0 ? (
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="text-[10px] py-2">{isRTL ? 'پۆل' : 'Category'}</TableHead>
                          <TableHead className="text-[10px] py-2">{isRTL ? 'کۆی گشتی بڕ' : 'Total Amount'}</TableHead>
                          <TableHead className="w-[40%] text-[10px] py-2">{isRTL ? 'پیشاندانی گرافیکی' : 'Visualization'}</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {chartData.map((item, index) => {
                          const percentage = grandTotal > 0 ? (item.total / grandTotal) * 100 : 0;
                          return (
                              <TableRow key={item.name} className="odd:bg-table-row-secondary even:bg-table-row-primary">
                                  <TableCell className="py-2 text-xs font-semibold">{item.name}</TableCell>
                                  <TableCell className="py-2 text-xs font-semibold">{formatCurrency(item.total)}</TableCell>
                                  <TableCell className="py-2">
                                      <div className="flex items-center gap-2">
                                          <Progress value={percentage} style={{ backgroundColor: item.fill }} />
                                          <span className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</span>
                                      </div>
                                  </TableCell>
                              </TableRow>
                          );
                      })}
                  </TableBody>
              </Table>
          ) : (
              <p className="text-center text-muted-foreground py-8 text-xs">{t('no_records_found_for_month', {month: selectedDate ? format(selectedDate, 'MMMM yyyy') : t('the_selected_month')})}</p>
          )}
      </CardContent>
   </Card>
  );

  return (
    <>
      <div className="hidden print:block">
        <ReportWrapper>
          <DashboardContent />
        </ReportWrapper>
      </div>

      <div className="print:hidden w-full font-sans">
        <div className="space-y-6 w-full">
          <DashboardContent />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.map((item) => (
              <DashboardCard
                key={item.title}
                title={item.title}
                icon={item.icon}
                href={item.href}
                onClick={item.onClick}
                color={item.color}
              />
            ))}
          </div>

          {/* 💰 Full Comprehensive Employee Expenses Module */}
          <div className="pt-4 border-t border-slate-200 dark:border-zinc-800">
            <AdminExpensesModule employees={employees} />
          </div>

          {/* Salary Settings Dialog */}
          <Dialog open={isSalaryModalOpen} onOpenChange={setIsSalaryModalOpen}>
            <DialogContent className="max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-base font-bold">
                  {isRTL ? 'ڕێکخستنی مووچە و زیادە' : 'Salary & Rate Settings'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isRTL ? 'دیاریکردنی نرخی کاتژمێری زیادە و پاداشت بە دیناری عێراقی' : 'Configure hourly overtime rate and bonus per load in IQD.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <Label htmlFor="overtime-rate" className="text-xs font-semibold">
                    {t('overtime_rate_per_hour')} (IQD)
                  </Label>
                  <Input
                    id="overtime-rate"
                    type="number"
                    value={salaryRates.overtimeRate}
                    onChange={(e) => setSalaryRates(prev => ({ ...prev, overtimeRate: e.target.valueAsNumber || 0 }))}
                    placeholder="5000"
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bonus-rate" className="text-xs font-semibold">
                    {t('bonus_rate_per_load')} (IQD)
                  </Label>
                  <Input
                    id="bonus-rate"
                    type="number"
                    value={salaryRates.bonusRate}
                    onChange={(e) => setSalaryRates(prev => ({ ...prev, bonusRate: e.target.valueAsNumber || 0 }))}
                    placeholder="5000"
                    className="h-10 text-sm"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setIsSalaryModalOpen(false)}>
                  {isRTL ? 'پاشگەزبوونەوە' : 'Cancel'}
                </Button>
                <Button onClick={handleSaveSalaryRates} disabled={isSavingRates}>
                  {isSavingRates ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {t('save_changes')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}

export default withAuth(AshleyExpensesDashboard);
