'use client';

import { useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/app-provider';
import { useTranslation } from '@/hooks/use-translation';
import { FilePdfCard } from '@/components/archive/file-pdf-card';

export default function PdfViewPage() {
  const params = useParams();
  const fileId = params.id as string;
  const { t, language } = useTranslation();
  const { excelFiles, items, employees, locations, settings } = useAppContext();
  const { appLogo, customFont, pdfSettings } = settings;


  const file = useMemo(() => excelFiles.find(f => f.id === fileId), [excelFiles, fileId]);
  const fileItems = useMemo(() => items.filter(i => i.fileId === fileId), [items, fileId]);
  
  const isLoading = !file || !fileItems || !employees || !locations;

  const handlePrint = () => {
    window.print();
  }

  if (isLoading) {
    return <div className="p-8">{t('loading')}...</div>
  }

  if (!file) {
    return (
      <div className="p-8">{t('file_not_found')}</div>
    );
  }
  
  const employeeForFile = employees?.find(e => e.id === file.storekeeperId);

  return (
    <>
      <div className="p-4 md:p-8 print:hidden">
        <header className="flex items-center justify-between gap-4 mb-8">
          <Button variant="outline" size="icon" asChild>
            <Link href="/pdf-archive"><ArrowLeft /></Link>
          </Button>
          <div className='flex items-center gap-2 flex-wrap justify-end'>
              <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> {t('print')}</Button>
          </div>
        </header>

        <div className="flex justify-center bg-gray-100 dark:bg-gray-900 p-8 rounded-lg">
            <div className="w-full max-w-4xl transform scale-100">
              {employeeForFile && (
                <FilePdfCard
                  file={file}
                  items={fileItems}
                  employee={employeeForFile}
                  locations={locations}
                  logoSrc={appLogo}
                  themeColor={pdfSettings.report.reportColors?.general || '#22c55e'}
                />
              )}
            </div>
        </div>
      </div>
       <div className="hidden print:block">
            {employeeForFile && (
                <FilePdfCard
                  file={file}
                  items={fileItems}
                  employee={employeeForFile}
                  locations={locations}
                  logoSrc={appLogo}
                  themeColor={pdfSettings.report.reportColors?.general || '#22c55e'}
                />
              )}
        </div>
    </>
  );
}
