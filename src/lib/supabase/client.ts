import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

/**
 * Generic helper to fetch JSON state stored in Supabase warehouses table
 */
export async function fetchSupabaseJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', key)
      .maybeSingle();

    if (error || !data?.qr_code) {
      return fallback;
    }
    return JSON.parse(data.qr_code) as T;
  } catch (err) {
    logger.warn(`[Supabase] Error reading ${key}:`, err);
    return fallback;
  }
}

/**
 * Generic helper to save JSON state into Supabase warehouses table
 */
export async function saveSupabaseJson<T>(key: string, name: string, payload: T): Promise<boolean> {
  try {
    const str = JSON.stringify(payload);
    const { error } = await supabase
      .from('warehouses')
      .upsert({
        id: key,
        name: name,
        qr_code: str,
      });

    if (error) {
      logger.error(`[Supabase] Error writing ${key}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    logger.error(`[Supabase] Exception saving ${key}:`, err);
    return false;
  }
}
