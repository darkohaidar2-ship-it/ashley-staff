'use client';

import { useMemo } from 'react';
import { useAppContext } from '@/context/app-provider';
import { useTranslation } from '@/hooks/use-translation';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { DollarSign, Clock, Gift, Banknote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import Link from 'next/link';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'IQD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const SummaryCard = ({ title, value, Icon, href }: { title: string, value: number, Icon: LucideIcon, href: string }) => (
    <Link href={href} className="block outline-none group">
        <div className="win-card h-24 flex flex-col justify-between p-4 group-hover:bg-accent/10">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-muted-foreground">
                    {title}
                </span>
                <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>

            <div>
                <div className="text-lg font-bold text-foreground tracking-tight">
                    {formatCurrency(value)}
                </div>
            </div>
        </div>
    </Link>
);

export function FinancialSummaries() {
  const { t } = useTranslation();
  const { expenses, overtime, bonuses, withdrawals } = useAppContext();
  const now = new Date();

  const monthlyTotals = useMemo(() => {
    const start = startOfMonth(now);
    const end = endOfMonth(now);

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
  }, [expenses, overtime, bonuses, withdrawals]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 financial-summaries-grid">
        <SummaryCard 
            title={t('expenses')} 
            value={monthlyTotals.expenses} 
            Icon={DollarSign} 
            href="/ashley-expenses"
        />
        <SummaryCard 
            title={t('overtime')} 
            value={monthlyTotals.overtime} 
            Icon={Clock} 
            href="/overtime"
        />
        <SummaryCard 
            title={t('bonuses')} 
            value={monthlyTotals.bonuses} 
            Icon={Gift} 
            href="/bonuses"
        />
        <SummaryCard 
            title={t('cash_withdrawals')} 
            value={monthlyTotals.withdrawals} 
            Icon={Banknote} 
            href="/cash-withdrawal"
        />
    </div>
  );
}
