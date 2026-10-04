import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8898240606:AAGKTldXKyJEIfGL8ggU42MlvJclgZVIa1c';

export async function GET(req: NextRequest) {
  try {
    const host = req.headers.get('host') || 'ashley-staff.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

    const setRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`
    );
    const setJson = await setRes.json();

    const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const infoJson = await infoRes.json();

    return NextResponse.json({
      success: setJson.ok,
      webhookUrl,
      telegramResponse: setJson,
      webhookInfo: infoJson,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
