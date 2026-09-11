import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ylttlgklfdyhmqwblaex.supabase.co';
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_4isRbaASi-6q45nw5_LxbQ_5dRrAwWt';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

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
    console.warn(`[Supabase] Error reading ${key}:`, err);
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
      console.error(`[Supabase] Error writing ${key}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Supabase] Exception saving ${key}:`, err);
    return false;
  }
}
