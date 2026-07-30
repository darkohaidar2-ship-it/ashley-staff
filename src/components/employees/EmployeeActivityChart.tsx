
'use client';

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO, getYear } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTranslation } from '@/hooks/use-translation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Expense, Overtime, Bonus, CashWithdrawal } from '@/lib/types';
import { BarChart3 } from 'lucide-react';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'IQD',
    maximumFractionDigits: 0,
  }).format(amount);
};

type ActivityData = {
    expenses: Expense[];
    overtime: Overtime[];
    bonuses: Bonus[];
    withdrawals: CashWithdrawal[];
};

export function EmployeeActivityChart({ activityData }: { activityData: ActivityData }) {
    const { t } = useTranslation();
    const [selectedYear, setSelectedYear] = useState<string>(String(getYear(new Date())));

    const { chartData, availableYears, hasData } = useMemo(() => {
        const allData = [
            ...activityData.expenses,
            ...activityData.overtime,
            ...activityData.bonuses,
            ...activityData.withdrawals,
        ];
        
        const years = [...new Set(allData.map(d => getYear(parseISO(d.date))))].sort((a,b) => b-a);
        if(years.length === 0) years.push(getYear(new Date()));
        
        const currentYear = parseInt(selectedYear);

        const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
            month: format(new Date(currentYear, i, 1), 'MMM'),
            Expenses: 0,
            Overtime: 0,
            Bonuses: 0,
            Withdrawals: 0,
        }));

        activityData.expenses.forEach(item => {
            const date = parseISO(item.date);
            if (getYear(date) === currentYear) {
                monthlyTotals[date.getMonth()].Expenses += item.amount;
            }
        });
        activityData.overtime.forEach(item => {
            const date = parseISO(item.date);
            if (getYear(date) === currentYear) {
                monthlyTotals[date.getMonth()].Overtime += item.totalAmount;
            }
        });
        activityData.bonuses.forEach(item => {
            const date = parseISO(item.date);
            if (getYear(date) === currentYear) {
                monthlyTotals[date.getMonth()].Bonuses += item.totalAmount;
            }
        });
        activityData.withdrawals.forEach(item => {
            const date = parseISO(item.date);
            if (getYear(date) === currentYear) {
                monthlyTotals[date.getMonth()].Withdrawals -= item.amount; // Negative value
            }
        });

        const dataExists = monthlyTotals.some(m => m.Expenses > 0 || m.Overtime > 0 || m.Bonuses > 0 || m.Withdrawals < 0);

        return { chartData: monthlyTotals, availableYears: years.map(String), hasData: dataExists };
    }, [activityData, selectedYear]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><BarChart3/> {t('yearly_activity_overview')}</CardTitle>
                    
                </div>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent>
                {hasData ? (
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} />
                            <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                cursor={{ fill: 'hsl(var(--accent))' }}
                                contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                            />
                            <Legend />
                            <Bar dataKey="Expenses" name={t('expenses')} stackId="a" fill="hsl(var(--chart-4))" />
                            <Bar dataKey="Overtime" name={t('overtime')} stackId="a" fill="hsl(var(--chart-2))" />
                            <Bar dataKey="Bonuses" name={t('bonuses')} stackId="a" fill="hsl(var(--chart-1))" />
                            <Bar dataKey="Withdrawals" name={t('cash_withdrawals')} stackId="a" fill="hsl(var(--chart-5))" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-[350px] items-center justify-center">
                        <p className="text-muted-foreground">{t('no_activity_for_year', { year: selectedYear })}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
