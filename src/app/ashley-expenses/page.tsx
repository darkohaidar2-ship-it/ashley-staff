
'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar as CalendarIcon, Printer, DollarSign, Clock, Gift, Banknote, FileText, Settings, FileDown } from 'lucide-react';
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
import { ReportWrapper } from '@/components/reports/ReportWrapper';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
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
  const { expenses, overtime, bonuses, withdrawals, settings } = useAppContext();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const isRTL = language === 'ku';
  
  const menuItems = [
    { title: t('expenses'), icon: DollarSign, href: '/expenses', color: 'bg-blue-500' },
    { title: t('overtime'), icon: Clock, href: '/overtime', color: 'bg-orange-500' },
    { title: t('bonuses'), icon: Gift, href: '/bonuses', color: 'bg-green-500' },
    { title: t('cash_withdrawals'), icon: Banknote, href: '/cash-withdrawal', color: 'bg-rose-500' },
    { title: t('monthly_reports'), icon: FileText, href: '/monthly-report', color: 'bg-indigo-500' },
    { title: t('settings'), icon: Settings, href: '/ashley-expenses-settings', color: 'bg-gray-500' },
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
                color={item.color}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default withAuth(AshleyExpensesDashboard);
