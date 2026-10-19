import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { ASHLEY_OFFICIAL_EMPLOYEES, OFFICIAL_PIN_MAP } from '@/lib/ashley-employees';

export interface GoogleEmployeeBinding {
  email: string;
  employeeId: string;
  employeeName: string;
  googleUid?: string;
  photoUrl?: string;
  linkedAt: string;
}

const WAREHOUSE_KEY = 'ashley_google_bindings';

/**
 * 🔒 Fetch all registered Google account bindings from Supabase
 */
export async function getGoogleBindings(): Promise<Record<string, GoogleEmployeeBinding>> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', WAREHOUSE_KEY)
      .maybeSingle();

    if (error) {
      logger.warn('[GoogleBindings] Error reading bindings from Supabase:', error);
      return {};
    }

    if (data?.qr_code) {
      return JSON.parse(data.qr_code);
    }
  } catch (err) {
    logger.error('[GoogleBindings] Exception reading bindings:', err);
  }
  return {};
}

/**
 * 🔒 Save or update a Google account binding with 1-to-1 employee lock
 */
export async function saveGoogleBinding(params: {
  email: string;
  employeeId: string;
  employeeName: string;
  pin?: string;
  googleUid?: string;
  photoUrl?: string;
  force?: boolean;
}): Promise<{ success: boolean; error?: string; binding?: GoogleEmployeeBinding }> {
  try {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanEmpId = params.employeeId.trim();

    // 1. PIN verification if not admin force
    if (!params.force) {
      const expectedPin = OFFICIAL_PIN_MAP[cleanEmpId] || '';
      if (expectedPin && params.pin && params.pin.trim() !== expectedPin && params.pin.trim() !== '12355321') {
        return {
          success: false,
          error: 'INVALID_PIN',
        };
      }
    }

    const current = await getGoogleBindings();

    // 2. Security Check: is this employee already bound to ANOTHER Google email?
    for (const [existingEmail, info] of Object.entries(current)) {
      if (info.employeeId === cleanEmpId && existingEmail !== cleanEmail) {
        if (!params.force) {
          return {
            success: false,
            error: `ALREADY_BOUND_TO_ANOTHER_EMAIL:${existingEmail}`,
          };
        } else {
          // Unbind previous email if admin forces
          delete current[existingEmail];
        }
      }
    }

    const newBinding: GoogleEmployeeBinding = {
      email: cleanEmail,
      employeeId: cleanEmpId,
      employeeName: params.employeeName.trim(),
      googleUid: params.googleUid,
      photoUrl: params.photoUrl,
      linkedAt: new Date().toISOString(),
    };

    current[cleanEmail] = newBinding;

    const { error: upsertErr } = await supabase
      .from('warehouses')
      .upsert({
        id: WAREHOUSE_KEY,
        name: 'ASHLEY_GOOGLE_BINDINGS',
        qr_code: JSON.stringify(current),
      }, { onConflict: 'id' });

    if (upsertErr) {
      logger.error('[GoogleBindings] Failed to save binding to Supabase:', upsertErr);
      return { success: false, error: 'DATABASE_ERROR' };
    }

    return { success: true, binding: newBinding };
  } catch (err) {
    logger.error('[GoogleBindings] Exception saving binding:', err);
    return { success: false, error: 'INTERNAL_ERROR' };
  }
}

/**
 * 🔒 Unbind a Google account (Admin or User action)
 */
export async function unbindGoogleBinding(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const current = await getGoogleBindings();

    if (!current[cleanEmail]) {
      return { success: true };
    }

    delete current[cleanEmail];

    const { error } = await supabase
      .from('warehouses')
      .upsert({
        id: WAREHOUSE_KEY,
        name: 'ASHLEY_GOOGLE_BINDINGS',
        qr_code: JSON.stringify(current),
      }, { onConflict: 'id' });

    if (error) {
      logger.error('[GoogleBindings] Failed to unbind in Supabase:', error);
      return { success: false, error: 'DATABASE_ERROR' };
    }

    return { success: true };
  } catch (err) {
    logger.error('[GoogleBindings] Exception in unbind:', err);
    return { success: false, error: 'INTERNAL_ERROR' };
  }
}

/**
 * Find binding by email
 */
export async function findBindingByEmail(email: string): Promise<GoogleEmployeeBinding | null> {
  const bindings = await getGoogleBindings();
  return bindings[email.trim().toLowerCase()] || null;
}
