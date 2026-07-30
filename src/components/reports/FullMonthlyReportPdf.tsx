
'use client';
import { Employee, AppSettings } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(amount);

type FullMonthlyReportPdfProps = {
    records: any[]; // The combined records
    grandTotals: any;
    getEmployeeName: (id: string, useKurdish?: boolean) => string;
};

export const FullMonthlyReportPdf = ({ records, grandTotals, getEmployeeName }: FullMonthlyReportPdfProps) => {
    const { t, language } = useTranslation();
    const useKurdish = language === 'ku';

    return (
        <Table className="pdf-table">
            <TableHeader>
                <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead className="text-right">{t('salary')}</TableHead>
                    <TableHead className="text-right">{t('overtime')}</TableHead>
                    <TableHead className="text-right">{t('bonuses')}</TableHead>
                    <TableHead className="text-right">{t('expenses')}</TableHead>
                    <TableHead className="text-right">{t('cash_withdrawals')}</TableHead>
                    <TableHead className="text-right font-bold">{t('net_salary')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {records.map(record => (
                    <TableRow key={record.employeeId}>
                        <TableCell>{getEmployeeName(record.employeeId, useKurdish)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.salary)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.totalOvertime)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(record.totalBonuses)}</TableCell>
                        <TableCell className="text-right text-red-500">{formatCurrency(record.totalExpenses)}</TableCell>
                        <TableCell className="text-right text-red-500">{formatCurrency(record.totalWithdrawals)}</TableCell>
                        <TableCell className="text-right font-bold text-primary">{formatCurrency(record.netSalary)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell className="font-bold">{t('grand_total')}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(grandTotals.salary)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(grandTotals.totalOvertime)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(grandTotals.totalBonuses)}</TableCell>
                    <TableCell className="text-right font-bold text-red-500">{formatCurrency(grandTotals.totalExpenses)}</TableCell>
                    <TableCell className="text-right font-bold text-red-500">{formatCurrency(grandTotals.totalWithdrawals)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatCurrency(grandTotals.netSalary)}</TableCell>
                </TableRow>
            </TableFooter>
        </Table>
    );
};
