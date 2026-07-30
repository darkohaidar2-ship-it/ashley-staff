
'use server';
/**
 * @fileOverview AI flow to extract structured inventory data from PDF text with high precision.
 * 
 * Target Columns: Index (#), Model (مودێل), Quantity (دانە), Status (دۆخی), 
 * Storage Status (دۆخی کۆگاکردن), Location (شوێن), Notes (تێبینی).
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ExtractedItemSchema = z.object({
  model: z.string().describe('The product model code (مودێل). Must not be empty.'),
  quantity: z.number().describe('The quantity of items (دانە). Default to 0 if missing.'),
  status: z.string().describe('The item condition/status (دۆخی). Default to "unknown" if unclear.'),
  warehouse_status: z.string().describe('The verification or storage status (دۆخی کۆگاکردن).'),
  location: z.string().describe('The physical warehouse position (شوێن). If multiple, provide as comma-separated string.'),
  notes: z.string().describe('Remarks or additional info (تێبینی). Keep original text and language.'),
});

const ParsePdfInventoryInputSchema = z.object({
  text: z.string().describe('The raw text extracted from the PDF document.'),
});

const ParsePdfInventoryOutputSchema = z.object({
  items: z.array(ExtractedItemSchema).describe('The list of extracted items from the document.'),
});

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

const parsePrompt = ai.definePrompt({
  name: 'parsePdfInventoryPrompt',
  input: { schema: ParsePdfInventoryInputSchema },
  output: { schema: ParsePdfInventoryOutputSchema },
  prompt: `
    You are an expert data extraction assistant for an ERP warehouse system.
    Your task is to analyze the provided raw text from a PDF and extract a structured inventory list.

    RULES:
    1. The PDF is a table with columns: # (Index), Model (مودێل), Quantity (دانە), Status (دۆخی), Storage Status (دۆخی کۆگاکردن), Location (شوێن), Notes (تێبینی).
    2. Detect table rows even if text is split across lines or fields are multi-line.
    3. Clean and normalize data: Trim spaces, merge broken words, and KEEP original language (Kurdish/Arabic/English).
    4. Validation:
       - Model MUST NOT be empty.
       - Quantity MUST be a number (default 0).
       - Status defaults to "unknown" if missing.
    5. Handle special cases:
       - If multiple locations exist for one model, merge them with commas.
       - Capture full text in Notes without removal.
    6. Ignore all visual styling (colors, highlights, decorative elements).
    7. This is a multi-page document. Combine all rows into one continuous dataset.

    RAW TEXT:
    {{{text}}}

    Return a clean JSON array of objects following the defined output schema.
  `,
});

const parsePdfInventoryFlow = ai.defineFlow(
  {
    name: 'parsePdfInventoryFlow',
    inputSchema: ParsePdfInventoryInputSchema,
    outputSchema: ParsePdfInventoryOutputSchema,
  },
  async (input) => {
    const { output } = await parsePrompt(input);
    return output!;
  }
);

export async function parsePdfInventory(input: { text: string }) {
  return parsePdfInventoryFlow(input);
}
