
'use client';
import { CashWithdrawal, AppSettings } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useMemo } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { ReportWrapper } from '@/components/reports/ReportWrapper';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(amount);

export const CashWithdrawalReportPdf = ({ records, date, settings, getEmployeeName }: { records: CashWithdrawal[], date: Date, settings: AppSettings, getEmployeeName: (id: string, useKurdish?: boolean) => string }) => {
    const { t, language } = useTranslation();
    const useKurdish = language === 'ku';

    const totalAmount = useMemo(() => {
        return records.reduce((acc, record) => acc + record.amount, 0);
    }, [records]);

    return (
        <ReportWrapper
            title={t('daily_cash_withdrawals')}
            date={date}
        >
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('employee')}</TableHead>
                        <TableHead>{t('notes')}</TableHead>
                        <TableHead className="text-right">{t('amount_iqd')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map(record => (
                        <TableRow key={record.id}>
                            <TableCell>{getEmployeeName(record.employeeId, useKurdish)}</TableCell>
                            <TableCell>{record.notes || t('na')}</TableCell>
                            <TableCell className="text-right">{formatCurrency(record.amount)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={2} className="text-right">{t('total')}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalAmount)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </ReportWrapper>
    );
};
