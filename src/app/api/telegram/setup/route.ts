import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ 
        error: 'TELEGRAM_BOT_TOKEN is not configured in Vercel environment variables.' 
      }, { status: 500 });
    }

    // Require setup authorization to prevent unauthorized public webhook resets
    const { searchParams } = new URL(req.url);
    const setupSecret = searchParams.get('key') || searchParams.get('secret');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET || 'ashley_secure_webhook_secret_key_2027';

    const adminSession = req.cookies.get('ashley_admin_session')?.value;
    if (!adminSession && setupSecret !== expectedSecret) {
      return NextResponse.json({ 
        error: 'Unauthorized: Admin authentication or ?secret= parameter required.' 
      }, { status: 401 });
    }

    const host = req.headers.get('host') || 'ashley-staff.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const webhookUrl = `${protocol}://${host}/api/telegram/webhook`;

    const setRes = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(expectedSecret)}&drop_pending_updates=true`
    );
    const setJson = await setRes.json();

    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const infoJson = await infoRes.json();

    return NextResponse.json({
      success: setJson.ok,
      webhookUrl,
      hasSecretToken: Boolean(expectedSecret),
      telegramResponse: setJson,
      webhookInfo: infoJson,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
