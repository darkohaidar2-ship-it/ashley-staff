
'use server';
/**
 * @fileOverview An AI flow to generate multiple answers for a "reality check".
 *
 * This file defines the `realityCheck` function, which generates three distinct answers for a given question.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const RealityCheckInputSchema = z.object({
  question: z.string().describe('The question to be answered.'),
});
type RealityCheckInput = z.infer<typeof RealityCheckInputSchema>;

const RealityCheckResponseSchema = z.object({
  answer1: z.string().describe('A concise and direct answer to the question.'),
  answer2: z.string().describe('An alternative answer, potentially from a different perspective or with more detail.'),
  answer3: z.string().describe('A third answer that might be more creative, nuanced, or consider edge cases.'),
});
type RealityCheckResponse = z.infer<typeof RealityCheckResponseSchema>;

const realityCheckPrompt = ai.definePrompt({
  name: 'realityCheckPrompt',
  input: { schema: RealityCheckInputSchema },
  output: { schema: RealityCheckResponseSchema },
  prompt: `
    You are an expert evaluator. For the given question, provide three distinct and high-quality answers.
    Each answer should explore a different valid angle or perspective on the question.

    Question: {{{question}}}
  `,
});

const realityCheckFlow = ai.defineFlow(
  {
    name: 'realityCheckFlow',
    inputSchema: RealityCheckInputSchema,
    outputSchema: RealityCheckResponseSchema,
  },
  async (input) => {
    const { output } = await realityCheckPrompt(input);
    return output!;
  }
);

export async function realityCheck(input: RealityCheckInput): Promise<RealityCheckResponse> {
  return realityCheckFlow(input);
}
