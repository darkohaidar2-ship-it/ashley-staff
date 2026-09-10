import { SupabaseClient } from '@supabase/supabase-js';

export interface EmployeeProfileData {
  userId: string;
  name?: string;
  role?: string;
  pin?: string;
  phone?: string;
  hireDate?: string;
  photo?: string | null;
  address?: string;
  emergencyContact?: string;
}

/**
 * Fetch employee profile details from Supabase (checking both warehouses registry and users table)
 */
export async function getEmployeeProfile(supabase: SupabaseClient, userId: string) {
  if (!userId) {
    return { success: false, error: 'کارمەند دیاری نەکراوە' };
  }

  let profilesMap: Record<string, any> = {};
  try {
    const { data: pRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_employee_profiles')
      .maybeSingle();
    if (pRow?.qr_code) profilesMap = JSON.parse(pRow.qr_code);
  } catch {}

  const customProfile = profilesMap[userId] || {};
  let dbUser: any = null;
  try {
    const { data: u } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (u) dbUser = u;
  } catch {}

  return {
    success: true,
    profile: {
      userId,
      name: dbUser?.name || customProfile.name,
      role: dbUser?.role || customProfile.role,
      pin: dbUser?.pin || customProfile.pin,
      phone: customProfile.phone || dbUser?.phone || '',
      hireDate: customProfile.hireDate || dbUser?.hire_date || '',
      photo: customProfile.photo || dbUser?.avatar || null,
    }
  };
}

/**
 * Update employee profile details in both warehouses resilient registry and users table
 */
export async function updateEmployeeProfile(supabase: SupabaseClient, payload: EmployeeProfileData) {
  const { userId, phone, address, emergencyContact, pin, photo, hireDate, name } = payload;
  if (!userId) {
    return { success: false, error: 'کارمەند دیاری نەکراوە' };
  }

  try {
    // 1. Resilient registry in warehouses
    const { data: pRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_employee_profiles')
      .maybeSingle();
    
    let profilesMap: Record<string, any> = {};
    if (pRow?.qr_code) {
      try { profilesMap = JSON.parse(pRow.qr_code); } catch {}
    }

    profilesMap[userId] = {
      ...(profilesMap[userId] || {}),
      userId,
      ...(name ? { name } : {}),
      ...(pin ? { pin } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(hireDate !== undefined ? { hireDate } : {}),
      ...(photo !== undefined ? { photo } : {}),
      updatedAt: new Date().toISOString(),
    };

    await supabase.from('warehouses').upsert({
      id: 'ashley_employee_profiles',
      name: 'Ashley Employee Profiles Data',
      qr_code: JSON.stringify(profilesMap),
      lat: 0,
      lng: 0,
      radius: 0,
    });

    // 2. Also update users table
    const updatePayload: any = {};
    if (phone !== undefined) updatePayload.phone = phone;
    if (address !== undefined) updatePayload.address = address;
    if (emergencyContact !== undefined) updatePayload.emergency_contact = emergencyContact;
    if (pin !== undefined && pin.length >= 4) updatePayload.pin = pin;

    await supabase.from('users').update(updatePayload).eq('id', userId);

    return { success: true, message: 'زانیارییەکان بە سەرکەوتوویی نوێکرانەوە' };
  } catch (err: any) {
    console.warn('Update profile error:', err);
    return { success: false, error: err.message || 'هەڵەیەک ڕوویدا لە نوێکردنەوە' };
  }
}
