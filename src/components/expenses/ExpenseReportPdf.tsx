'use client';

import { Employee, Expense, ExpenseReport, AllPdfSettings } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { useTranslation } from '@/hooks/use-translation';
import { ReportWrapper } from '@/components/reports/ReportWrapper';
import { useMemo } from 'react';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(amount);

type ExpenseReportPdfProps = {
  report: ExpenseReport;
  items: Expense[];
  employees: Employee[];
  settings: AllPdfSettings;
};

export function ExpenseReportPdf({ report, items, employees, settings }: ExpenseReportPdfProps) {
  const { t, language } = useTranslation();

  const getEmployeeName = (employeeId: string, useKurdish: boolean = false) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return t('unknown');
    return useKurdish && employee.kurdishName ? employee.kurdishName : employee.name;
  };
  
  const groupedExpenses = useMemo(() => {
    if (!items || !employees) return [];
    
    const groups: Record<string, { employeeName: string; expenses: Expense[]; total: number }> = {};
    
    items.forEach(exp => {
      if (!groups[exp.employeeId]) {
        groups[exp.employeeId] = {
          employeeName: getEmployeeName(exp.employeeId, language === 'ku'),
          expenses: [],
          total: 0
        };
      }
      groups[exp.employeeId].expenses.push(exp);
      groups[exp.employeeId].total += exp.amount;
    });

    return Object.values(groups).sort((a,b) => b.total - a.total);
  }, [items, employees, language, getEmployeeName, t]);

  return (
    <ReportWrapper
      title={report.reportName}
      date={format(parseISO(report.reportDate), 'PPP')}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-base font-medium mb-2">{t('summary_by_employee')}</h2>
          <Table className="pdf-table">
            <TableHeader><TableRow><TableHead>{t('employee')}</TableHead><TableHead className="text-right">{t('total_amount')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {groupedExpenses.map((group, index) => (
                <TableRow key={group.employeeName}>
                  <TableCell dir={language === 'ku' ? 'rtl' : 'ltr'} className="py-1">{group.employeeName}</TableCell>
                  <TableCell className="text-right py-1">{formatCurrency(group.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
             <TableFooter>
                <TableRow>
                    <TableCell className="text-right font-medium">{t('grand_total')}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(report.totalAmount)}</TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </div>
        {items.length > 0 && (
          <div>
            <h2 className="text-base font-medium mb-2">{t('all_transactions')}</h2>
            <Table className="pdf-table">
              <TableHeader><TableRow><TableHead>{t('employee')}</TableHead><TableHead>{t('expense_type')}</TableHead><TableHead>{t('notes')}</TableHead><TableHead className="text-right">{t('amount')}</TableHead></TableRow></TableHeader>
              <TableBody>
                {items.sort((a,b) => getEmployeeName(a.employeeId).localeCompare(getEmployeeName(b.employeeId))).map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell dir={language === 'ku' ? 'rtl' : 'ltr'} className="py-1">{getEmployeeName(item.employeeId, language === 'ku')}</TableCell>
                    <TableCell className="py-1 text-xs">{t(item.expenseType.toLowerCase().replace(/[\s()]/g, '_'))}{item.expenseSubType ? ` (${t(item.expenseSubType.toLowerCase().replace(/\s/g, '_'))})` : ''}</TableCell>
                    <TableCell className="text-gray-600 py-1 text-xs">{item.notes || t('na')}</TableCell>
                    <TableCell className="text-right py-1">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </ReportWrapper>
  );
}
