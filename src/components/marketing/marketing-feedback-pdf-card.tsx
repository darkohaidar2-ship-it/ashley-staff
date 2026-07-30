
'use client';

import { format } from 'date-fns';
import Image from 'next/image';
import { useTranslation } from '@/hooks/use-translation';

type EvaluationSummary = {
  employeeId: string;
  name: string;
  score: number;
}[];

type MarketingFeedbackPdfCardProps = {
  logoSrc: string | null;
  totalEvaluations: number;
  evaluationSummary: EvaluationSummary;
};


export function MarketingFeedbackPdfCard({ logoSrc, totalEvaluations, evaluationSummary }: MarketingFeedbackPdfCardProps) {
  const { t, language } = useTranslation();
  const formattedDate = format(new Date(), 'MMMM d, yyyy');
  const useKurdish = language === 'ku';

  return (
    <div className="bg-white text-black w-full p-4 font-sans border-2 border-gray-200 rounded-xl" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <div className="flex justify-between items-start pb-4 border-b-2 border-gray-200" dir={useKurdish ? 'rtl' : 'ltr'}>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{t('marketing_feedback_report')}</h1>
          <p className="text-lg font-semibold text-gray-600">{formattedDate}</p>
        </div>
        <div className="w-[80px] h-[80px] flex items-center justify-center">
            {logoSrc && <Image src={logoSrc} alt={t('company_logo')} width={60} height={60} className="object-contain" />}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 py-4" dir={useKurdish ? 'rtl' : 'ltr'}>
         <div className="flex flex-col items-center justify-center">
            <p className="text-sm text-gray-500">{t('total_evaluations_submitted')}</p>
            <p className="text-4xl font-bold text-gray-800">{totalEvaluations}</p>
         </div>
      </div>
      
      {evaluationSummary.length > 0 && (
        <div className="pt-4 border-t-2 border-gray-100" dir={useKurdish ? 'rtl' : 'ltr'}>
            <h2 className="text-center font-bold text-gray-700 mb-2">{t('employee_performance')}</h2>
        </div>
      )}
    </div>
  );
};
