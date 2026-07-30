
'use client';
import { MarketingFeedback, EvaluationQuestion, Employee } from '@/lib/types';
import { MarketingFeedbackPdfCard } from './marketing-feedback-pdf-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from '@/hooks/use-translation';

export const MarketingReportPdf = ({ logoSrc, totalEvaluations, evaluationSummary, perQuestionRankings }: { logoSrc: string | null, totalEvaluations: number, evaluationSummary: any[], perQuestionRankings: any[] }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-white text-black p-6">
            <MarketingFeedbackPdfCard logoSrc={logoSrc} totalEvaluations={totalEvaluations} evaluationSummary={evaluationSummary} />
            <div className="mt-6">
                <h2 className="text-xl font-bold mb-4">{t('employee_performance')}</h2>
                <Table>
                    <TableHeader><TableRow><TableHead>{t('rank')}</TableHead><TableHead>{t('employee')}</TableHead><TableHead className="text-right">{t('total_score')}</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {evaluationSummary.map((item, index) => (
                            <TableRow key={item.employeeId}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="text-right">{item.score}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {perQuestionRankings && perQuestionRankings.length > 0 && perQuestionRankings.map(q => (
                    <div key={q.questionId} className="mt-8">
                        <h3 className="text-lg font-bold mb-2">{t(q.questionText.toLowerCase().replace(/ /g, '_')) || q.questionText}</h3>
                        <Table>
                             <TableHeader><TableRow><TableHead>{t('rank')}</TableHead><TableHead>{t('employee')}</TableHead><TableHead className="text-right">{t('total_score')}</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {q.scores.map((s: any, rankIndex: number) => (
                                    <TableRow key={s.name}>
                                        <TableCell>{rankIndex + 1}</TableCell>
                                        <TableCell>{s.name}</TableCell>
                                        <TableCell className="text-right">{s.score}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ))}
            </div>
        </div>
    );
};
