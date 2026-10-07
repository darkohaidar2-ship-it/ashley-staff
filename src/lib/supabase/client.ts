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

// In-Memory Fast Cache for all warehouse records to eliminate 25x waterfall calls
let WAREHOUSE_CACHE: Record<string, any> = {};
let WAREHOUSE_CACHE_LOADED = false;
let BATCH_FETCH_PROMISE: Promise<Record<string, any>> | null = null;

export function updateSupabaseMemoryCache(key: string, value: any) {
  WAREHOUSE_CACHE[key] = value;
}

/**
 * Coalesced single-query batch loader for all warehouse JSON keys
 * Eliminates up to 25 separate HTTP roundtrips on initial load
 */
export async function fetchAllSupabaseWarehouseJson(force = false): Promise<Record<string, any>> {
  if (!force && WAREHOUSE_CACHE_LOADED && Object.keys(WAREHOUSE_CACHE).length > 0) {
    return WAREHOUSE_CACHE;
  }
  if (BATCH_FETCH_PROMISE) {
    return BATCH_FETCH_PROMISE;
  }

  BATCH_FETCH_PROMISE = (async () => {
    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, qr_code');

      if (error || !data) {
        return WAREHOUSE_CACHE;
      }

      const map: Record<string, any> = {};
      for (const row of data) {
        if (!row.id || !row.qr_code) continue;
        try {
          map[row.id] = typeof row.qr_code === 'string' ? JSON.parse(row.qr_code) : row.qr_code;
        } catch {
          map[row.id] = row.qr_code;
        }
      }
      WAREHOUSE_CACHE = { ...WAREHOUSE_CACHE, ...map };
      WAREHOUSE_CACHE_LOADED = true;
      return WAREHOUSE_CACHE;
    } catch (err) {
      logger.warn('[Supabase] Error in batch fetch warehouses:', err);
      return WAREHOUSE_CACHE;
    } finally {
      BATCH_FETCH_PROMISE = null;
    }
  })();

  return BATCH_FETCH_PROMISE;
}

/**
 * High-performance helper to fetch JSON state stored in Supabase warehouses table
 * Resolves in 0ms from memory or coalesces with the single global batch fetch
 */
export async function fetchSupabaseJson<T>(key: string, fallback: T): Promise<T> {
  try {
    // 1. If already present in memory cache, return immediately (0ms latency)
    if (WAREHOUSE_CACHE[key] !== undefined) {
      return WAREHOUSE_CACHE[key] as T;
    }

    // 2. Coalesce into the single batch fetch if not loaded yet
    if (!WAREHOUSE_CACHE_LOADED || BATCH_FETCH_PROMISE) {
      await fetchAllSupabaseWarehouseJson();
      if (WAREHOUSE_CACHE[key] !== undefined) {
        return WAREHOUSE_CACHE[key] as T;
      }
    }

    // 3. Fallback: single item query if key was missing from batch
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', key)
      .maybeSingle();

    if (error || !data?.qr_code) {
      return fallback;
    }
    const parsed = typeof data.qr_code === 'string' ? JSON.parse(data.qr_code) : data.qr_code;
    WAREHOUSE_CACHE[key] = parsed;
    return parsed as T;
  } catch (err) {
    logger.warn(`[Supabase] Error reading ${key}:`, err);
    return fallback;
  }
}

/**
 * Generic helper to save JSON state into Supabase warehouses table
 */
export async function saveSupabaseJson<T>(key: string, name: string, payload: T): Promise<boolean> {
  // Optimistically update memory cache immediately
  WAREHOUSE_CACHE[key] = payload;
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

