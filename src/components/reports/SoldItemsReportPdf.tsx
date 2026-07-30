
'use client';
import { SoldItemsList, AppSettings, ItemCategory } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format, parseISO } from 'date-fns';
import { useTranslation } from '@/hooks/use-translation';
import { ReportWrapper } from '@/components/reports/ReportWrapper';

export const SoldItemsReportPdf = ({ list, categories, settings }: { list: SoldItemsList, categories: ItemCategory[], settings: AppSettings }) => {
    const { t, language } = useTranslation();
    const useKurdish = language === 'ku';

    const getCategoryName = (id: string) => {
        return categories.find(c => c.id === id)?.name || 'N/A';
    }

    return (
        <ReportWrapper
            title={list.name}
            date={format(parseISO(list.date), 'PPPP')}
        >
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{t('item_name')}</TableHead>
                        <TableHead>{t('category')}</TableHead>
                        <TableHead className="text-center">{t('quantity')}</TableHead>
                        <TableHead>{t('notes')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {list.items.map(item => (
                        <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{getCategoryName(item.categoryId)}</TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell>{item.notes || t('na')}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ReportWrapper>
    );
};
