
'use server';
/**
 * @fileOverview An AI flow to translate an English name to Kurdish.
 * 
 * This file defines the `translateNameToKurdish` function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const TranslateNameInputSchema = z.object({
  name: z.string().describe('The English name to be translated.'),
});
type TranslateNameInput = z.infer<typeof TranslateNameInputSchema>;

const TranslateNameOutputSchema = z.object({
  kurdishName: z.string().describe('The suggested Kurdish translation of the name.'),
});
type TranslateNameOutput = z.infer<typeof TranslateNameOutputSchema>;

const translateNamePrompt = ai.definePrompt({
  name: 'translateNamePrompt',
  input: { schema: TranslateNameInputSchema },
  output: { schema: TranslateNameOutputSchema },
  prompt: `
    Translate the following English name to its most common Kurdish equivalent.
    Provide only the Kurdish name as the translation.

    English Name: {{{name}}}
  `,
});

const translateNameFlow = ai.defineFlow(
  {
    name: 'translateNameFlow',
    inputSchema: TranslateNameInputSchema,
    outputSchema: TranslateNameOutputSchema,
  },
  async (input) => {
    const { output } = await translateNamePrompt(input);
    return output!;
  }
);

export async function translateNameToKurdish(input: TranslateNameInput): Promise<TranslateNameOutput> {
  return translateNameFlow(input);
}
