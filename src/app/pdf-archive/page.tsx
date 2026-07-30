'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Calendar as CalendarIcon, User, Building, FileDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppContext } from '@/context/app-provider';
import type { Employee, ExcelFile } from '@/lib/types';
import { useTranslation } from '@/hooks/use-translation';
import withAuth from '@/hooks/withAuth';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

function PdfArchivePage() {
  const { excelFiles, employees, isLoading } = useAppContext();
  const { t, language } = useTranslation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');

  const getEmployeeName = (id: string) => {
    return employees?.find(e => e.id === id)?.name || 'Unknown';
  };

  const sortedAndFilteredFiles = useMemo(() => {
    if (!excelFiles) return [];
    
    let filteredFiles = [...excelFiles];

    if (searchQuery) {
        filteredFiles = filteredFiles.filter(file => 
            file.storageName.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    
    return filteredFiles.sort((a, b) => {
      const dateA = a.date ? parseISO(a.date).getTime() : 0;
      const dateB = b.date ? parseISO(b.date).getTime() : 0;
      return dateB - dateA;
    });
  }, [excelFiles, searchQuery]);

  const handleExportAll = () => {
    if (!sortedAndFilteredFiles || sortedAndFilteredFiles.length === 0) {
        toast({ title: t('no_data_to_export') });
        return;
    }

    const dataToExport = sortedAndFilteredFiles.map(file => ({
        [t('file_name')]: file.storageName,
        [t('category')]: file.categoryName,
        [t('storekeeper')]: getEmployeeName(file.storekeeperId),
        [t('source')]: file.source,
        [t('date')]: file.date ? format(parseISO(file.date), 'yyyy-MM-dd') : 'N/A',
        [t('type')]: file.type,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('pdf_archive'));
    XLSX.writeFile(workbook, `PDF_Archive_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-background text-foreground flex flex-col">
        <header className="bg-card border-b p-4 print:hidden">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                  <Link href="/items"><ArrowLeft /></Link>
                </Button>
                <h1 className="text-xl">{t('pdf_archive')}</h1>
            </div>
             <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-48" />
                <Button variant="outline" size="icon" disabled>
                    <FileDown className="h-4 w-4" />
                </Button>
            </div>
          </div>
        </header>
        <main className="w-full p-4 md:p-8 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex flex-col">
      <header className="bg-card border-b p-4 print:hidden">
        <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" asChild>
                <Link href="/items">
                  <ArrowLeft />
                  <span className="sr-only">{t('back_to_placement_storage')}</span>
                </Link>
              </Button>
              <h1 className="text-xl">{t('pdf_archive')}</h1>
            </div>
            <div className="flex items-center gap-2">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder={language === 'ku' ? "گەڕان بەپێی ناوی فایل..." : "Search by file name..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-48"
                    />
                </div>
                <Button onClick={handleExportAll} variant="outline" size="icon">
                    <FileDown className="h-4 w-4" />
                    <span className="sr-only">{language === 'ku' ? "هەناردەکردنی هەموو بۆ ئێکسڵ" : "Export All to Excel"}</span>
                </Button>
            </div>
        </div>
      </header>
      <main className="w-full p-4 md:p-8 flex-1 overflow-y-auto">
        {sortedAndFilteredFiles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedAndFilteredFiles.map(file => (
              <Card key={file.id} className="hover:border-primary hover:shadow-xl transition-all h-full flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start gap-2">
                      <CardTitle className="text-lg leading-tight">
                        <Link href={`/pdf/archive/${file.id}`} target="_blank" className="hover:underline">
                          {file.storageName}
                        </Link>
                      </CardTitle>
                      <Badge variant={file.type === 'imported' ? 'default' : 'secondary'}>{file.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-3 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><User className="w-4 h-4 text-primary" /> {getEmployeeName(file.storekeeperId)}</p>
                  <p className="flex items-center gap-2"><Building className="w-4 h-4 text-primary" /> {file.source}</p>
                  <p className="flex items-center gap-2"><CalendarIcon className="w-4 h-4 text-primary" /> {file.date ? format(parseISO(file.date), 'PPP') : 'Invalid Date'}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">{t('no_archived_files')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {searchQuery 
                ? (language === 'ku' ? `هیچ فایلێک نەدۆزرایەوە کە بگونجێت لەگەڵ "${searchQuery}".` : `No files found matching "${searchQuery}".`)
                : t('no_archived_files_desc')
              }
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default withAuth(PdfArchivePage);
