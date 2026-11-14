import { NextRequest, NextResponse } from 'next/server';
import { supabase, fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface AudioSettings {
  elevenLabsApiKey?: string;
  voiceId?: string;
}

const DEFAULT_ELEVEN_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel / Multi-lingual default

/**
 * Fetch or generate Kurdish audio clip, cache in Supabase, and stream to mobile
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model, qty, spokenText, arabicPhoneticText, cacheKey } = body;

    if (!cacheKey || !spokenText) {
      return NextResponse.json({ error: 'Missing cacheKey or spokenText' }, { status: 400 });
    }

    const supabaseDocId = `audio_clip_${cacheKey}`;

    // 1. Check if audio is already cached in Supabase
    const cachedData = await fetchSupabaseJson<{ base64?: string; text?: string; mime?: string } | null>(
      supabaseDocId,
      null
    );

    if (cachedData && cachedData.base64) {
      const audioBuffer = Buffer.from(cachedData.base64, 'base64');
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': cachedData.mime || 'audio/mpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Ashley-Audio-Source': 'supabase-cache',
        },
      });
    }

    // 2. Retrieve configured ElevenLabs API key (from env OR Supabase settings)
    const envKey = process.env.ELEVENLABS_API_KEY || '';
    const audioSettings = await fetchSupabaseJson<AudioSettings>('ashley_warehouse_audio_settings', {});
    const apiKey = (audioSettings.elevenLabsApiKey || envKey || '').trim();
    const voiceId = (audioSettings.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVEN_VOICE_ID).trim();

    let audioBuffer: Buffer | null = null;
    let audioSource = 'elevenlabs-generated';

    // 3. Option A: Request audio from ElevenLabs if apiKey is available
    if (apiKey) {
      try {
        const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
        const ttsRes = await fetch(ttsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
          },
          body: JSON.stringify({
            text: spokenText,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        });

        if (ttsRes.ok) {
          const audioArrayBuffer = await ttsRes.arrayBuffer();
          audioBuffer = Buffer.from(audioArrayBuffer);
          audioSource = 'elevenlabs-generated';
        } else {
          const errText = await ttsRes.text().catch(() => '');
          logger.warn('[KurdishAudio] ElevenLabs error, falling back to Google TTS:', errText);
        }
      } catch (e: any) {
        logger.warn('[KurdishAudio] ElevenLabs exception, falling back to Google TTS:', e.message);
      }
    }

    // 4. Option B: High-Quality Free Google TTS Engine (Instant, 100% Free, Arabic-Phonetic Kurdish)
    if (!audioBuffer) {
      try {
        const phonetic = (arabicPhoneticText || spokenText || '').trim();
        const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=${encodeURIComponent(phonetic)}`;
        const gRes = await fetch(googleUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (gRes.ok) {
          const arrayBuffer = await gRes.arrayBuffer();
          if (arrayBuffer.byteLength > 100) {
            audioBuffer = Buffer.from(arrayBuffer);
            audioSource = 'google-tts-free';
          }
        }
      } catch (gErr: any) {
        logger.warn('[KurdishAudio] Google TTS fetch failed:', gErr.message);
      }
    }

    if (!audioBuffer || audioBuffer.length < 50) {
      return NextResponse.json(
        { error: 'Failed to generate audio stream from both ElevenLabs and Google TTS' },
        { status: 502 }
      );
    }

    const base64Audio = audioBuffer.toString('base64');

    // 5. Save to Supabase so it's NEVER queried again
    await saveSupabaseJson(supabaseDocId, `Kurdish Audio ${model || ''}`, {
      base64: base64Audio,
      text: spokenText,
      model,
      qty,
      mime: 'audio/mpeg',
      source: audioSource,
      createdAt: new Date().toISOString(),
    });

    // 6. Return audio to mobile client
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Ashley-Audio-Source': audioSource,
      },
    });
  } catch (err: any) {
    logger.error('[KurdishAudio] Exception in audio generation:', err);
    return NextResponse.json({ error: 'Server exception', details: err.message }, { status: 500 });
  }
}

/**
 * GET: Retrieve audio settings or status
 */
export async function GET() {
  const audioSettings = await fetchSupabaseJson<AudioSettings>('ashley_warehouse_audio_settings', {});
  const hasEnvKey = Boolean(process.env.ELEVENLABS_API_KEY);
  const hasConfiguredKey = Boolean(audioSettings.elevenLabsApiKey || hasEnvKey);

  return NextResponse.json({
    hasConfiguredKey,
    hasEnvKey,
    voiceId: audioSettings.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_ELEVEN_VOICE_ID,
  });
}
