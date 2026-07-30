'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from 'date-fns';
import type { Employee, ExcelFile, Item, StorageLocation } from "@/lib/types";
import { ReportWrapper } from "../reports/ReportWrapper";
import { useTranslation } from "@/hooks/use-translation";
import { cn, WAREHOUSE_COLORS } from "@/lib/utils";

type FileReportPdfProps = {
  file: ExcelFile;
  items: Item[];
  employee: Employee;
  locations: StorageLocation[];
  logoSrc: string | null;
  themeColor: string;
};

export function FilePdfCard({ file, items, employee, locations }: FileReportPdfProps) {
    const { t, language } = useTranslation();
    const useKurdish = language === 'ku';

    const getLocationName = (id?: string) => locations?.find(l => l.id === id)?.name || 'N/A';

    return (
        <ReportWrapper
            title={file.storageName}
            date={file.date ? format(parseISO(file.date), 'dd/MM/yyyy') : 'N/A'}
        >
            <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-[10px] uppercase font-bold tracking-tight", useKurdish && "text-right")} dir={useKurdish ? 'rtl' : 'ltr'}>
                <div className="p-3 bg-slate-50 border rounded-xl">
                    <p className="opacity-40 mb-1">{t('storekeeper')}</p>
                    <p className="text-slate-900">{employee.name}</p>
                </div>
                <div className="p-3 bg-slate-50 border rounded-xl">
                    <p className="opacity-40 mb-1">{t('source_location')}</p>
                    <p className="text-slate-900">{file.source}</p>
                </div>
                <div className="p-3 bg-slate-50 border rounded-xl">
                    <p className="opacity-40 mb-1">{t('category_name')}</p>
                    <p className="text-slate-900">{file.categoryName}</p>
                </div>
                <div className="p-3 bg-slate-50 border rounded-xl">
                    <p className="opacity-40 mb-1">{t('type')}</p>
                    <p className="text-slate-900">{file.type}</p>
                </div>
            </div>

             <div className="overflow-x-auto border-2 border-slate-200 rounded-2xl shadow-sm">
                <Table className="w-full">
                    <TableHeader className="bg-slate-100">
                        <TableRow className="hover:bg-transparent border-b-2 border-slate-200">
                            <TableHead className="text-[9px] font-black text-slate-900 uppercase h-10 px-3 text-right">ناسنامەی مۆدێل</TableHead>
                            <TableHead className="text-[9px] font-black text-slate-900 uppercase h-10 px-3 text-center w-16">دانە</TableHead>
                            <TableHead className="text-[9px] font-black text-slate-900 uppercase h-10 px-3 text-center">پشکنین</TableHead>
                            <TableHead className="text-[9px] font-black text-slate-900 uppercase h-10 px-3 text-center">دۆخی کاڵا</TableHead>
                            <TableHead className="text-[9px] font-black text-slate-900 uppercase h-10 px-3 text-right">شوێن</TableHead>
                            <TableHead className="text-[9px] font-black text-slate-900 uppercase h-10 px-3 text-right">تێبینییەکان</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items?.map((item) => {
                            const loc = locations?.find(l => l.id === item.locationIds?.[0]);
                            const rowColor = loc?.warehouseType === 'Huana' 
                                ? `${WAREHOUSE_COLORS.Huana.bg}/20 print:${WAREHOUSE_COLORS.Huana.bg}/20` 
                                : loc?.warehouseType === 'Ashley' 
                                ? `${WAREHOUSE_COLORS.Ashley.bg}/30 print:${WAREHOUSE_COLORS.Ashley.bg}/30` 
                                : 'hover:bg-slate-50/50';

                            return (
                                <TableRow key={item.id} className={cn("border-b border-slate-100", rowColor)}>
                                    <TableCell className="py-2.5 px-3 font-bold text-[11px] text-slate-900">{item.model}</TableCell>
                                <TableCell className="py-2.5 px-3 text-center font-black text-[12px] text-primary">{item.quantity}</TableCell>
                                <TableCell className="py-2.5 px-3 text-center text-[10px] font-bold">
                                    {item.storageStatus ? (
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-full border",
                                            item.storageStatus === 'Correct' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                                        )}>
                                            {item.storageStatus}
                                        </span>
                                    ) : '-'}
                                </TableCell>
                                <TableCell className="py-2.5 px-3 text-center text-[10px] font-bold">
                                    {item.modelCondition || '-'}
                                </TableCell>
                                <TableCell className="py-2.5 px-3 font-mono font-bold text-[10px] text-slate-600">
                                    {getLocationName(item.locationIds?.[0])}
                                </TableCell>
                                <TableCell className="py-2.5 px-3 text-slate-500 text-[10px] leading-tight max-w-[200px]">
                                    {item.notes || '-'}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                        {(!items || items.length === 0) && (
                            <TableRow><TableCell colSpan={6} className="h-32 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">هیچ تۆمارێک نەدۆزرایەوە</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
              </div>
        </ReportWrapper>
    );
}