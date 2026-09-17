import { supabase, fetchSupabaseJson, saveSupabaseJson } from '@/lib/supabase/client';
import { initialSettings } from '@/context/initial-data';
import type { AppSettings } from '@/lib/types';

export const APP_SETTINGS_KEY = 'ashley_global_settings';

/**
 * Fetch global system settings from Supabase warehouses table
 */
export async function fetchAppSettings(): Promise<Partial<AppSettings> | null> {
  try {
    const data = await fetchSupabaseJson<Partial<AppSettings> | null>(APP_SETTINGS_KEY, null);
    if (!data) return null;
    return data;
  } catch (err) {
    console.error('[SettingsService] Error fetching global settings:', err);
    return null;
  }
}

/**
 * Save global system settings to Supabase warehouses table for cloud persistence & realtime sync
 */
export async function saveAppSettings(settings: AppSettings): Promise<boolean> {
  try {
    // Sanitize: strip static translation dictionaries to keep payload small & lightning fast
    const { translations, ...sanitizedSettings } = settings;
    return await saveSupabaseJson<Partial<AppSettings>>(
      APP_SETTINGS_KEY,
      'Ashley Global System Settings',
      sanitizedSettings
    );
  } catch (err) {
    console.error('[SettingsService] Error saving global settings:', err);
    return false;
  }
}
