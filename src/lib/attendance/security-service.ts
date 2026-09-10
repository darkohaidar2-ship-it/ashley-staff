import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get overall security status for all users (device binding, face registered, timestamps)
 */
export async function getSecurityStatus(supabase: SupabaseClient) {
  try {
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('id, name, role, device_token, is_device_bound, has_face_registered, face_descriptors, face_updated_at')
      .order('name');

    if (uErr) {
      console.warn('Security status fetch users error:', uErr);
    }

    // Also get central device bindings registry
    const { data: devRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_device_bindings')
      .maybeSingle();

    let devRegistry: Record<string, any> = {};
    if (devRow?.qr_code) {
      try { devRegistry = JSON.parse(devRow.qr_code); } catch {}
    }

    // Also get central face registry
    const { data: faceRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_face_registry')
      .maybeSingle();

    let faceRegistry: Record<string, any> = {};
    if (faceRow?.qr_code) {
      try { faceRegistry = JSON.parse(faceRow.qr_code); } catch {}
    }

    const mergedUsers = (users || []).map(u => {
      const devInfo = devRegistry[u.id];
      const faceInfo = faceRegistry[u.id];
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        deviceToken: u.device_token || devInfo?.deviceToken || null,
        isDeviceBound: Boolean(u.is_device_bound || (devInfo && !devInfo.unbound)),
        hasFaceRegistered: Boolean(u.has_face_registered || (faceInfo && faceInfo.descriptors && faceInfo.descriptors.length > 0)),
        faceAnglesCount: faceInfo?.descriptors?.length || (u.face_descriptors ? u.face_descriptors.length : 0),
        faceUpdatedAt: u.face_updated_at || faceInfo?.updatedAt || null,
        deviceInfo: devInfo || null,
      };
    });

    return { success: true, users: mergedUsers };
  } catch (err: any) {
    console.warn('getSecurityStatus error:', err);
    return { success: false, error: err.message || 'هەڵە لە وەرگرتنی دۆخی ئاسایش' };
  }
}

/**
 * Reset a user's bound mobile device
 */
export async function resetUserDevice(supabase: SupabaseClient, userId: string) {
  if (!userId) return { success: false, error: 'کارمەند دیاری نەکراوە' };

  try {
    // 1. Update users table
    await supabase.from('users').update({
      device_token: null,
      is_device_bound: false,
    }).eq('id', userId);

    // 2. Update central device registry
    const { data: regRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_device_bindings')
      .maybeSingle();

    let registry: Record<string, any> = {};
    if (regRow?.qr_code) {
      try { registry = JSON.parse(regRow.qr_code); } catch {}
    }

    if (registry[userId]) {
      delete registry[userId];
      await supabase.from('warehouses').upsert({
        id: 'ashley_device_bindings',
        name: 'Ashley Device & Hardware Registry',
        qr_code: JSON.stringify(registry),
        lat: 0,
        lng: 0,
        radius: 0
      });
    }

    return { success: true, message: 'مۆبایلەکە بە سەرکەوتوویی لە ئەدمینەوە هەڵوەشێنرایەوە' };
  } catch (err: any) {
    console.warn('resetUserDevice error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Reset a user's registered Face ID
 */
export async function resetUserFace(supabase: SupabaseClient, userId: string) {
  if (!userId) return { success: false, error: 'کارمەند دیاری نەکراوە' };

  try {
    // 1. Update users table
    await supabase.from('users').update({
      face_descriptor: null,
      face_descriptors: null,
      has_face_registered: false,
      face_updated_at: null,
    }).eq('id', userId);

    // 2. Update central face registry
    const { data: regRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_face_registry')
      .maybeSingle();

    let registry: Record<string, any> = {};
    if (regRow?.qr_code) {
      try { registry = JSON.parse(regRow.qr_code); } catch {}
    }

    if (registry[userId]) {
      delete registry[userId];
      await supabase.from('warehouses').upsert({
        id: 'ashley_face_registry',
        name: 'Ashley Face Biometrics Registry',
        qr_code: JSON.stringify(registry),
        lat: 0,
        lng: 0,
        radius: 0
      });
    }

    return { success: true, message: 'ڕوخساری کارمەند بە سەرکەوتوویی سفر کرایەوە' };
  } catch (err: any) {
    console.warn('resetUserFace error:', err);
    return { success: false, error: err.message };
  }
}
