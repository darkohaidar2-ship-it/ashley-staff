import { fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import type { MarketingFeedback, EvaluationQuestion } from '@/lib/types';
import { initialData } from '@/context/initial-data';

export const MARKETING_FEEDBACKS_KEY = 'ashley_marketing_feedbacks';
export const EVALUATION_QUESTIONS_KEY = 'ashley_evaluation_questions';

// ===================== MARKETING FEEDBACKS =====================
export async function fetchMarketingFeedbacks(): Promise<MarketingFeedback[]> {
  try {
    const list = await fetchSupabaseJson<MarketingFeedback[]>(MARKETING_FEEDBACKS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.marketingFeedbacks || [];
    if (fallback.length > 0) {
      await saveMarketingFeedbacks(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[EvaluationService] Error fetching marketing feedbacks:', err);
    return initialData.marketingFeedbacks || [];
  }
}

export async function saveMarketingFeedbacks(records: MarketingFeedback[]): Promise<boolean> {
  return await saveSupabaseJson<MarketingFeedback[]>(
    MARKETING_FEEDBACKS_KEY,
    'Ashley Employee Marketing Feedbacks',
    records
  );
}

// ===================== EVALUATION QUESTIONS =====================
export async function fetchEvaluationQuestions(): Promise<EvaluationQuestion[]> {
  try {
    const list = await fetchSupabaseJson<EvaluationQuestion[]>(EVALUATION_QUESTIONS_KEY, []);
    if (list && list.length > 0) return list;
    const fallback = initialData.evaluationQuestions || [];
    if (fallback.length > 0) {
      await saveEvaluationQuestions(fallback);
      return fallback;
    }
    return [];
  } catch (err) {
    console.error('[EvaluationService] Error fetching evaluation questions:', err);
    return initialData.evaluationQuestions || [];
  }
}

export async function saveEvaluationQuestions(records: EvaluationQuestion[]): Promise<boolean> {
  return await saveSupabaseJson<EvaluationQuestion[]>(
    EVALUATION_QUESTIONS_KEY,
    'Ashley Staff Performance Evaluation Questions',
    records
  );
}
