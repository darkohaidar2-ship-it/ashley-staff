
'use client';
import { Bonus, AppSettings } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useMemo } from 'react';
import { useTranslation } from '@/hooks/use-translation';
import { ReportWrapper } from '@/components/reports/ReportWrapper';

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IQD', maximumFractionDigits: 0 }).format(amount);

export const BonusReportPdf = ({ records, date, settings, getEmployeeName }: { records: Bonus[], date: Date, settings: AppSettings, getEmployeeName: (id: string, useKurdish?: boolean) => string }) => {
    const { t, language } = useTranslation();
    const useKurdish = language === 'ku';

    const { totalLoads, totalAmount } = useMemo(() => {
        return records.reduce(
            (acc, record) => {
                acc.totalLoads += record.loadCount;
                acc.totalAmount += record.totalAmount;
                return acc;
            }, { totalLoads: 0, totalAmount: 0 });
    }, [records]);

    return (
        <ReportWrapper
            title={t('daily_bonus_report')}
            date={date}
        >
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('employee')}</TableHead>
                        <TableHead className="text-center">{t('number_of_loads')}</TableHead>
                        <TableHead className="text-center">{t('salary')}</TableHead>
                        <TableHead>{t('notes')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map(record => (
                        <TableRow key={record.id}>
                            <TableCell>{getEmployeeName(record.employeeId, useKurdish)}</TableCell>
                            <TableCell className="text-center">{record.loadCount}</TableCell>
                            <TableCell className="text-center">{formatCurrency(record.totalAmount)}</TableCell>
                            <TableCell>{record.notes || t('na')}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-muted/50 font-bold">
                        <TableCell>{t('total')}</TableCell>
                        <TableCell className="text-center">{totalLoads}</TableCell>
                        <TableCell className="text-center">{formatCurrency(totalAmount)}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </ReportWrapper>
    );
};
