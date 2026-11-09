import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { SheetsAuditItem, SheetsAuditSession } from '@/app/api/warehouse/sheets-sync/route';
import * as XLSX from 'xlsx';

const SESSIONS_STORE_ID = 'ashley_sheets_audit_sessions';

async function getStoredSessions(): Promise<Record<string, SheetsAuditSession>> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', SESSIONS_STORE_ID)
      .maybeSingle();

    if (error || !data?.qr_code) return {};
    return typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
  } catch (err) {
    logger.error('[AI Parse API] Error reading sessions:', err);
    return {};
  }
}

async function saveStoredSessions(sessions: Record<string, SheetsAuditSession>): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify(sessions);
    const { error } = await supabase
      .from('warehouses')
      .upsert({
        id: SESSIONS_STORE_ID,
        qr_code: jsonStr,
        warehouse_name: 'Ashley Google Sheets Warehouse Sessions',
        location: 'Cloud DB',
        updated_at: new Date().toISOString(),
      });

    if (error) {
      logger.error('[AI Parse API] Error saving sessions:', error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error('[AI Parse API] Exception saving sessions:', err);
    return false;
  }
}

/**
 * 🧠 Intelligent Algorithmic Fallback for Packing Lists & Shipping Manifests
 */
function heuristicPackingListParser(text: string): {
  items: SheetsAuditItem[];
  totalExpected: number;
  totalCartons: number;
} {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items: SheetsAuditItem[] = [];
  let totalExpected = 0;
  let totalCartons = 0;

  lines.forEach((line, idx) => {
    // Look for patterns like:
    // [MODEL] ... [CARTONS] ... [PCS/CTN] ... [TOTAL]
    // or tab/comma/pipe separated values
    const parts = line.split(/[\t,|;]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return;

    // Check if line looks like a header
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('model') && (lowerLine.includes('qty') || lowerLine.includes('carton') || lowerLine.includes('ctn'))) {
      return; // Skip header
    }

    // Try finding Model (first alphanumeric code with letters and numbers or uppercase)
    let model = '';
    let name = '';
    let cartonCount = 0;
    let pcsPerCarton = 1;
    let expectedQty = 0;

    // Search tokens
    const numbers: number[] = [];
    parts.forEach((part) => {
      const numMatch = part.match(/^\d+(\.\d+)?$/);
      if (numMatch) {
        numbers.push(parseFloat(numMatch[0]));
      } else if (!model && /[A-Za-z0-9-_]{3,}/.test(part) && !/^(total|pcs|carton|ctn|box|kg|cbm)$/i.test(part)) {
        model = part;
      } else if (model && !name && part.length > 2) {
        name = part;
      }
    });

    if (!model && parts[0]) {
      model = parts[0];
    }

    if (numbers.length >= 3) {
      // Typically: [CartonCount, PcsPerCarton, TotalQty]
      cartonCount = numbers[0];
      pcsPerCarton = numbers[1];
      expectedQty = numbers[2];
    } else if (numbers.length === 2) {
      // [CartonCount, TotalQty] or [Cartons, PcsPerCarton]
      cartonCount = numbers[0];
      expectedQty = numbers[1];
      if (cartonCount > 0 && expectedQty >= cartonCount) {
        pcsPerCarton = Math.max(1, Math.round(expectedQty / cartonCount));
      }
    } else if (numbers.length === 1) {
      cartonCount = numbers[0];
      expectedQty = cartonCount;
      pcsPerCarton = 1;
    }

    if (model && (cartonCount > 0 || expectedQty > 0)) {
      if (expectedQty === 0 && cartonCount > 0) {
        expectedQty = cartonCount * pcsPerCarton;
      }
      if (cartonCount === 0 && expectedQty > 0) {
        cartonCount = expectedQty;
      }

      totalExpected += expectedQty;
      totalCartons += cartonCount;

      items.push({
        id: `ai_${idx}_${model}`,
        rowIndex: idx + 1,
        model,
        name: name || model,
        expectedQty,
        checkedQty: 0,
        cartonCount,
        pcsPerCarton,
        checkedCartons: 0,
        scannedCartonNumbers: [],
        variance: -expectedQty,
        condition: 'Packaged',
        auditStatus: 'pending',
      });
    }
  });

  return { items, totalExpected, totalCartons };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, mode = 'shipment_receiving', title } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ success: false, error: 'تکایە دەق یان خشتەی بارەکە دابنێ' }, { status: 400 });
    }

    let items: SheetsAuditItem[] = [];
    let totalExpected = 0;
    let totalCartons = 0;

    // 1. Try Gemini GenAI if available
    let geminiSuccess = false;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (apiKey) {
      try {
        const promptText = `
You are an expert shipping manifest and warehouse logistics AI for Ashley Furniture.
The user provided raw text from a complex shipping sheet or factory packing list.
Your task is to extract ONLY these essential columns and ignore all other noise (ignore invoice numbers, ports, CBM, gross weight, container number, etc.):
1. model: Model / item code (e.g. KB-901, SOF-200, ASH-450)
2. name: Item description or name
3. cartonCount: Total number of cartons / boxes (ژمارەی کارتۆن / پاکەت)
4. pcsPerCarton: Number of pieces inside each carton (دانە لە هەر کارتۆنێکدا)
5. totalQty: Total quantity in pieces (cartonCount * pcsPerCarton)

Return valid JSON with an array named "items":
{
  "items": [
    {
      "model": "KB-901",
      "name": "Dining Table",
      "cartonCount": 8,
      "pcsPerCarton": 1,
      "totalQty": 8
    }
  ]
}

RAW TEXT:
${text.slice(0, 8000)}
`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
        });

        if (res.ok) {
          const aiJson = await res.json();
          const rawTextContent = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawTextContent) {
            const parsed = JSON.parse(rawTextContent);
            const extracted = parsed.items || (Array.isArray(parsed) ? parsed : []);
            if (Array.isArray(extracted) && extracted.length > 0) {
              extracted.forEach((it: any, i: number) => {
                const ctn = Number(it.cartonCount) || 1;
                const pcs = Number(it.pcsPerCarton) || 1;
                const exp = Number(it.totalQty) || (ctn * pcs);
                totalExpected += exp;
                totalCartons += ctn;
                items.push({
                  id: `ai_${i}_${it.model || i}`,
                  rowIndex: i + 1,
                  model: String(it.model || `ITEM-${i + 1}`).trim(),
                  name: String(it.name || it.model || `کاڵای ${i + 1}`).trim(),
                  expectedQty: exp,
                  checkedQty: 0,
                  cartonCount: ctn,
                  pcsPerCarton: pcs,
                  checkedCartons: 0,
                  scannedCartonNumbers: [],
                  variance: -exp,
                  condition: 'Packaged',
                  auditStatus: 'pending',
                });
              });
              geminiSuccess = true;
            }
          }
        }
      } catch (aiErr) {
        logger.warn('[AI Parse API] Gemini failed, falling back to heuristic parser:', aiErr);
      }
    }

    // 2. Fallback to Heuristic Engine if AI didn't run or returned 0 items
    if (!geminiSuccess || items.length === 0) {
      // First try XLSX sheet parsing if it's tab/comma separated
      try {
        const wb = XLSX.read(text, { type: 'string' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
        if (rawData && rawData.length >= 2) {
          const heuristic = heuristicPackingListParser(text);
          items = heuristic.items;
          totalExpected = heuristic.totalExpected;
          totalCartons = heuristic.totalCartons;
        }
      } catch {
        const heuristic = heuristicPackingListParser(text);
        items = heuristic.items;
        totalExpected = heuristic.totalExpected;
        totalCartons = heuristic.totalCartons;
      }
    }

    if (items.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'زیرەکی دەستکرد نەیتوانی کاڵا و کارتۆنەکان بدۆزێتەوە. تکایە دڵنیابە لە هەبوونی ناوی مۆدێل و ژمارەی کارتۆن یان بڕ لە دەقەکەدا.',
      }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const sessionId = `audit_ai_${Date.now()}`;
    const defaultTitle = title || (mode === 'shipment_receiving'
      ? `پشکنینی باری نوێ • شرۆڤەی AI (${items.length} کاڵا • ${totalCartons} کارتۆن)`
      : `جەردی کۆگا • شرۆڤەی AI (${items.length} کاڵا)`);

    const session: SheetsAuditSession = {
      id: sessionId,
      title: defaultTitle,
      mode,
      createdAt: nowIso,
      updatedAt: nowIso,
      auditedBy: 'AI Smart Logistics',
      totalItemsCount: items.length,
      totalExpectedUnits: totalExpected,
      totalAuditedUnits: 0,
      totalCartonsCount: totalCartons,
      totalAuditedCartons: 0,
      matchedCount: 0,
      discrepantCount: items.length,
      damagedCount: 0,
      status: 'active',
      items,
    };

    const allSessions = await getStoredSessions();
    allSessions[sessionId] = session;
    await saveStoredSessions(allSessions);

    return NextResponse.json({
      success: true,
      session,
      aiUsed: geminiSuccess,
      itemsExtractedCount: items.length,
      totalCartons,
      totalExpectedUnits: totalExpected,
    });

  } catch (err: any) {
    logger.error('[AI Parse API] Fatal error:', err);
    return NextResponse.json({ success: false, error: err.message || 'هەڵەی نەزانراو لە سێرڤەر' }, { status: 500 });
  }
}
