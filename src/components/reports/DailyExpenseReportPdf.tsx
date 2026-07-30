
'use client';
import { Expense, AppSettings } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useMemo, Fragment } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { ReportWrapper } from '@/components/reports/ReportWrapper';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(amount);

type DailyExpenseReportPdfProps = {
  records: Expense[];
  date: Date;
  settings: AppSettings;
  getEmployeeName: (id: string, useKurdish?: boolean) => string;
};

export function DailyExpenseReportPdf({ records, date, settings, getEmployeeName }: DailyExpenseReportPdfProps) {
  const { t, language } = useTranslation();
  const useKurdish = language === 'ku';

  const { groupedExpenses, grandTotal } = useMemo(() => {
    const groups: Record<string, { employeeName: string; expenses: Expense[]; total: number }> = {};
    
    records.forEach(exp => {
      if (!groups[exp.employeeId]) {
        groups[exp.employeeId] = {
          employeeName: getEmployeeName(exp.employeeId, useKurdish),
          expenses: [],
          total: 0
        };
      }
      groups[exp.employeeId].expenses.push(exp);
      groups[exp.employeeId].total += exp.amount;
    });

    const grandTotal = records.reduce((sum, exp) => sum + exp.amount, 0);
    return { groupedExpenses: Object.values(groups), grandTotal };
  }, [records, getEmployeeName, useKurdish]);

  return (
    <ReportWrapper
      title={t('daily_expense_report')}
      date={date}
    >
      <Table className="pdf-table text-xs border">
        <TableHeader>
          <TableRow>
            <TableHead className="border">{t('employee')}</TableHead>
            <TableHead className="border">{t('expense_type')}</TableHead>
            <TableHead className="border">{t('notes')}</TableHead>
            <TableHead className="text-right border">{t('amount')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedExpenses.map(group => (
            <Fragment key={group.employeeName}>
              {group.expenses.map((exp, index) => (
                <TableRow key={exp.id}>
                  <TableCell className="border p-1">
                    {index === 0 ? group.employeeName : ''}
                  </TableCell>
                  <TableCell className="border p-1">
                    {t(exp.expenseType.toLowerCase().replace(/[\s()]/g, '_'))}
                    {exp.expenseSubType ? ` (${t(exp.expenseSubType.toLowerCase().replace(/\s/g, '_'))})` : ''}
                  </TableCell>
                  <TableCell className="border p-1 text-muted-foreground">{exp.notes || 'N/A'}</TableCell>
                  <TableCell className="text-right border p-1">{formatCurrency(exp.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell colSpan={3} className="text-right border p-1">{group.employeeName} {t('total')}</TableCell>
                <TableCell className="text-right border p-1">{formatCurrency(group.total)}</TableCell>
              </TableRow>
            </Fragment>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="font-bold text-base bg-muted">
            <TableCell colSpan={3} className="text-right border p-2">{t('grand_total')}</TableCell>
            <TableCell className="text-right border p-2">{formatCurrency(grandTotal)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </ReportWrapper>
  );
}
