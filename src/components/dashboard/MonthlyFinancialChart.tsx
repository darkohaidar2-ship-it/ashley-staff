
'use client';

import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/app-provider';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, FileChartLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EditableText } from '@/components/shared/editable-text';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'IQD',
    maximumFractionDigits: 0,
  }).format(amount);
};

export function MonthlyFinancialChart() {
  const { t } = useTranslation();
  const { expenses, overtime, bonuses, withdrawals, settings } = useAppContext();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const monthlyTotals = useMemo(() => {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);

    const filterAndSum = (data: any[], amountField: string) => {
        if (!data) return 0;
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

  const chartData = useMemo(() => [
      { name: t('expenses'), total: monthlyTotals.expenses, fill: '#38bdf8' }, // Light Blue
      { name: t('overtime'), total: monthlyTotals.overtime, fill: '#94a3b8' }, // Grey
      { name: t('bonuses'), total: monthlyTotals.bonuses, fill: '#34d399' }, // Green
      { name: t('cash_withdrawals'), total: monthlyTotals.withdrawals, fill: '#64748b' }, // Darker Slate
  ], [t, monthlyTotals]);

  const chartConfig = {
    total: { label: t('amount') }
  };

  const hasData = useMemo(() => chartData.some((d) => d.total > 0), [chartData]);
  const router = useRouter();

  const customColor = settings?.customColors?.['monthly_overview'] || '';

  const getCardStyle = () => {
    if (customColor.includes('cyan')) return 'border-cyan-500/30 shadow-[0_8px_30px_rgba(6,182,212,0.08)]';
    if (customColor.includes('purple')) return 'border-purple-500/30 shadow-[0_8px_30px_rgba(168,85,247,0.08)]';
    if (customColor.includes('emerald')) return 'border-emerald-500/30 shadow-[0_8px_30px_rgba(16,185,129,0.08)]';
    if (customColor.includes('amber')) return 'border-amber-500/30 shadow-[0_8px_30px_rgba(245,158,11,0.08)]';
    if (customColor.includes('pink')) return 'border-pink-500/30 shadow-[0_8px_30px_rgba(236,72,153,0.08)]';
    if (customColor.includes('blue')) return 'border-blue-500/30 shadow-[0_8px_30px_rgba(59,130,246,0.08)]';
    return 'border-border shadow-sm';
  };

  return (
    <Card id="monthly-chart" className={cn("win-card h-full bg-card border overflow-hidden transition-all duration-700", getCardStyle())}>
      <CardHeader className="py-4 px-6 border-b border-border flex flex-row items-center justify-between">
          <div className="flex flex-col">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
                  <FileChartLine className={cn("w-4 h-4", customColor || "text-primary")} />
                  <EditableText keyName="monthly_overview" />
              </CardTitle>
          </div>
          <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2 border-border shadow-none text-[10px] font-black uppercase tracking-widest bg-secondary/50 hover:bg-secondary transition-all rounded-xl">
                     {format(selectedDate, 'MMM yyyy')} <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="glass-widget p-0 border-border" align="end">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    defaultMonth={selectedDate}
                    initialFocus
                    className="p-3"
                 />
            </PopoverContent>
          </Popover>
      </CardHeader>
      <CardContent className="p-6">
        {hasData ? (
            <div className="w-full h-[var(--dashboard-chart-height,280px)]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="cobaltGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1}/>
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                            </linearGradient>
                            <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.2}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground opacity-50" fontSize={10} fontWeight={800} tickLine={false} axisLine={false} />
                        <YAxis stroke="currentColor" className="text-muted-foreground opacity-50" fontSize={10} fontWeight={800} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value/1000).toFixed(0)}k`} />
                        <Tooltip 
                            formatter={(value: number) => <span className="font-black text-foreground">{formatCurrency(value)}</span>} 
                            cursor={{ fill: 'hsl(var(--secondary) / 0.2)' }} 
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover) / 0.8)',
                              backdropFilter: 'blur(20px)',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '12px',
                              padding: '12px',
                            }}
                        />
                        <Bar 
                            dataKey="total" 
                            radius={[8, 8, 0, 0]} 
                            barSize={32}
                            onMouseEnter={(data, index) => {}}
                        >
                            {chartData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={index === 0 ? 'url(#cobaltGradient)' : index === 2 ? 'url(#emeraldGradient)' : 'hsl(var(--muted-foreground) / 0.4)'} 
                                    className="filter hover:brightness-125 transition-all duration-300"
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        ) : (
             <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-secondary/50 border border-border flex items-center justify-center neon-glow">
                    <FileChartLine className="w-8 h-8 text-primary" />
                </div>
                <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] text-center">
                    {t('no_records_for')} <br/> <span className="text-primary">{format(selectedDate, 'MMM yyyy')}</span>
                </p>
             </div>
        )}
      </CardContent>
    </Card>
  );
}
