import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseUrl, supabaseKey } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// Get current Date and Time in Asia/Baghdad timezone (Kurdish Local Time)
function getBaghdadDateTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baghdad',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(now);

  const getVal = (type: string) => parts.find(p => p.type === type)!.value;
  const dateStr = `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
  const timeStr = `${getVal('hour')}:${getVal('minute')}`;

  return { dateStr, timeStr };
}

// Daily Token Generator (Changes every day based on date)
function getDailyToken() {
  const { dateStr } = getBaghdadDateTime();
  return crypto.createHash('sha256').update(dateStr + 'AshleyAttendanceSecretSaltKey').digest('hex').substring(0, 12);
}

// Haversine formula to check distance between two coordinates in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

// Upload base64 image to Supabase Storage
async function uploadSelfieToStorage(userId: string, date: string, type: string, base64Data: string) {
  if (!base64Data) return null;
  
  try {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Image, 'base64');
    const filename = `${userId}-${date}-${type}-${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
      .from('selfies')
      .upload(filename, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error('Error uploading to Supabase Storage:', error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from('selfies')
      .getPublicUrl(filename);

    return publicUrlData.publicUrl;
  } catch (err: any) {
    console.error('Failed to upload selfie:', err);
    return null;
  }
}

// Reverse Geocode lat/lng to Kurd/English Address using OpenStreetMap Nominatim
async function getAddressFromCoords(lat: number, lng: number) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ku,en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AshleyWarehouseAttendance/1.0' }
    });
    const data = await res.json();
    if (data && data.address) {
      const addr = data.address;
      const road = addr.road || addr.suburb || '';
      const suburb = addr.suburb || addr.neighbourhood || '';
      const city = addr.city || addr.town || addr.municipality || addr.county || '';
      const parts = [road, suburb, city].filter(Boolean);
      return parts.join(', ') || data.display_name || `${lat}, ${lng}`;
    }
    return data.display_name || `${lat}, ${lng}`;
  } catch (err) {
    console.error('Reverse geocoding error:', err);
    return `${lat}, ${lng}`;
  }
}

// Get Shift details for a date
async function getShiftForDate(dateStr: string) {
  try {
    const { data: override } = await supabase
      .from('shift_overrides')
      .select('*')
      .eq('date', dateStr)
      .maybeSingle();

    if (override) {
      return { checkInTime: override.check_in_time, checkOutTime: override.check_out_time };
    }

    const { data: defaultShift } = await supabase
      .from('shifts')
      .select('*')
      .eq('id', 'default')
      .single();

    return { checkInTime: defaultShift.check_in_time, checkOutTime: defaultShift.check_out_time };
  } catch (err) {
    console.error('Error getting shift:', err);
    return { checkInTime: "08:30", checkOutTime: "16:30" };
  }
}

// Handler for all requests
async function handle(req: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
  const path = params.path || [];
  const method = req.method;
  const pathStr = path.join('/');

  try {
    // ----------------------------------------
    // GET /api/attendance/employees
    // ----------------------------------------
    if (pathStr === 'employees' && method === 'GET') {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, device_token')
        .neq('role', 'admin');

      if (error) throw error;

      const employees = users.map(u => ({
        id: u.id,
        name: u.name,
        deviceBound: !!u.device_token
      }));

      return NextResponse.json(employees);
    }

    // ----------------------------------------
    // POST /api/attendance/check-device
    // ----------------------------------------
    if (pathStr === 'check-device' && method === 'POST') {
      const { deviceToken } = await req.json();
      if (!deviceToken) return NextResponse.json({ error: 'Device token is required' }, { status: 400 });

      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, role')
        .eq('device_token', deviceToken)
        .maybeSingle();

      if (error) throw error;

      if (user) {
        return NextResponse.json({ authenticated: true, user: { id: user.id, name: user.name, role: user.role } });
      } else {
        return NextResponse.json({ authenticated: false });
      }
    }

    // ----------------------------------------
    // POST /api/attendance/register-device
    // ----------------------------------------
    if (pathStr === 'register-device' && method === 'POST') {
      const { userId, pin, deviceToken } = await req.json();
      if (!userId || !pin || !deviceToken) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!user) return NextResponse.json({ error: 'کارمەندەکە نەدۆزرایەوە' }, { status: 404 });

      if (pin !== 'Bypass-QR-Pin' && user.pin !== pin) {
        return NextResponse.json({ error: 'کۆدی نهێنی (PIN) هەڵەیە' }, { status: 401 });
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ device_token: deviceToken })
        .eq('id', userId);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
    }

    // ----------------------------------------
    // POST /api/attendance/admin/login
    // ----------------------------------------
    if (pathStr === 'admin/login' && method === 'POST') {
      const { pin } = await req.json();
      if (pin === '12355321') return NextResponse.json({ success: true });

      const { data: admin, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin')
        .eq('pin', pin)
        .maybeSingle();

      if (error) throw error;

      if (admin) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json({ error: 'کۆدی ئەدمین هەڵەیە' }, { status: 401 });
      }
    }

    // ----------------------------------------
    // GET /api/attendance/warehouses
    // ----------------------------------------
    if (pathStr === 'warehouses' && method === 'GET') {
      const { data: warehouses, error } = await supabase
        .from('warehouses')
        .select('*');

      if (error) throw error;
      return NextResponse.json(warehouses);
    }

    // ----------------------------------------
    // GET /api/attendance/shifts
    // ----------------------------------------
    if (pathStr === 'shifts' && method === 'GET') {
      const { data: defaultShift } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', 'default')
        .single();

      const { data: overrides } = await supabase
        .from('shift_overrides')
        .select('*');

      const formattedOverrides: Record<string, any> = {};
      (overrides || []).forEach(o => {
        formattedOverrides[o.date] = { checkInTime: o.check_in_time, checkOutTime: o.check_out_time };
      });

      return NextResponse.json({
        default: { checkInTime: defaultShift?.check_in_time || '08:30', checkOutTime: defaultShift?.check_out_time || '16:30' },
        overrides: formattedOverrides
      });
    }

    // ----------------------------------------
    // POST /api/attendance/admin/shifts/default
    // ----------------------------------------
    if (pathStr === 'admin/shifts/default' && method === 'POST') {
      const { checkInTime, checkOutTime } = await req.json();
      if (!checkInTime || !checkOutTime) return NextResponse.json({ error: 'Invalid shift times' }, { status: 400 });

      const { error } = await supabase
        .from('shifts')
        .upsert({ id: 'default', check_in_time: checkInTime, check_out_time: checkOutTime });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ----------------------------------------
    // POST /api/attendance/admin/shifts/override
    // ----------------------------------------
    if (pathStr === 'admin/shifts/override' && method === 'POST') {
      const { date, checkInTime, checkOutTime } = await req.json();
      if (!date || !checkInTime || !checkOutTime) {
        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
      }

      const { error } = await supabase
        .from('shift_overrides')
        .upsert({ date, check_in_time: checkInTime, check_out_time: checkOutTime });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ----------------------------------------
    // POST /api/attendance/admin/shifts/remove-override
    // ----------------------------------------
    if (pathStr === 'admin/shifts/remove-override' && method === 'POST') {
      const { date } = await req.json();
      if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

      const { error } = await supabase
        .from('shift_overrides')
        .delete()
        .eq('date', date);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ----------------------------------------
    // POST /api/attendance/check-in-out-unified
    // ----------------------------------------
    if (pathStr === 'check-in-out-unified' && method === 'POST') {
      const { userId, deviceToken, warehouseId, selfie, lat, lng, token } = await req.json();
      
      if (!userId || !deviceToken || !lat || !lng || !selfie || !token) {
        return NextResponse.json({ error: 'هەموو زانیارییەکان پێویستن (وێنە، لۆکەیشن GPS، کۆدی نوێی ڕۆژ)' }, { status: 400 });
      }

      if (token !== getDailyToken()) {
        return NextResponse.json({ error: '⚠️ ئەم بەستەرە ماوەی بەسەرچووە! تکایە بارکۆدی نوێی شاشەکە سکان بکەرەوە.' }, { status: 400 });
      }

      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('device_token', deviceToken)
        .maybeSingle();

      if (userErr || !user) {
        return NextResponse.json({ error: 'ڕێگەپێنەدراو: ئەم مۆبایلە بە ناوی ئەم کارمەندەوە نەبەستراوەتەوە' }, { status: 401 });
      }

      let finalWarehouseId = warehouseId || null;
      let finalWarehouseName = 'دەروازەی سەرەکی';
      
      if (warehouseId) {
        const { data: warehouse } = await supabase
          .from('warehouses')
          .select('*')
          .eq('id', warehouseId)
          .maybeSingle();

        if (warehouse) {
          finalWarehouseId = warehouse.id;
          finalWarehouseName = warehouse.name;

          // Check Geofence
          const distance = getDistance(lat, lng, warehouse.lat, warehouse.lng);
          if (distance > warehouse.radius) {
            return NextResponse.json({ error: `تۆ زۆر دووریت لە کۆگاکە! دووری تۆ: ${Math.round(distance)} مەتر.` }, { status: 400 });
          }
        }
      }

      const { dateStr, timeStr } = getBaghdadDateTime();
      const address = await getAddressFromCoords(lat, lng);

      const { data: existingRecord } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .eq('date', dateStr)
        .maybeSingle();

      if (!existingRecord) {
        // Perform Check-In
        const selfieUrl = await uploadSelfieToStorage(userId, dateStr, 'in', selfie);
        if (!selfieUrl) return NextResponse.json({ error: 'شکست لە بارکردنی وێنەی دەوام' }, { status: 500 });

        const activeShift = await getShiftForDate(dateStr);
        const [shiftHour, shiftMin] = activeShift.checkInTime.split(':').map(Number);
        const [inHour, inMin] = timeStr.split(':').map(Number);
        
        const expectedMinutes = shiftHour * 60 + shiftMin;
        const actualMinutes = inHour * 60 + inMin;
        const lateMinutes = Math.max(0, actualMinutes - expectedMinutes);
        const isLate = lateMinutes > 5;

        const record = {
          id: `${userId}-${dateStr}`,
          user_id: userId,
          user_name: user.name,
          date: dateStr,
          check_in: new Date().toISOString(),
          check_in_time: timeStr,
          check_in_selfie: selfieUrl,
          check_in_lat: lat,
          check_in_lng: lng,
          check_in_address: address,
          warehouse_id: finalWarehouseId,
          warehouse_name: finalWarehouseName,
          late_minutes: isLate ? lateMinutes : 0,
          early_out_minutes: 0,
          status: isLate ? 'Late' : 'Present'
        };

        const { error: insertErr } = await supabase.from('attendance').insert(record);
        if (insertErr) throw insertErr;

        return NextResponse.json({
          success: true,
          type: 'in',
          employeeName: user.name,
          time: timeStr,
          status: record.status,
          message: isLate ? 'تۆ درەنگ هاتووی' : 'تۆ لە کاتی خۆیدا هاتووی',
          date: dateStr,
          address
        });
      } else {
        // Perform Check-Out
        if (existingRecord.check_out) {
          return NextResponse.json({ error: 'تۆ پێشتر هاتن و ڕۆشتنت بۆ ئەمڕۆ تۆمار کردووە!' }, { status: 400 });
        }

        const selfieUrl = await uploadSelfieToStorage(userId, dateStr, 'out', selfie);
        if (!selfieUrl) return NextResponse.json({ error: 'شکست لە بارکردنی وێنەی ڕۆشتن' }, { status: 500 });

        const activeShift = await getShiftForDate(dateStr);
        const [shiftHour, shiftMin] = activeShift.checkOutTime.split(':').map(Number);
        const [outHour, outMin] = timeStr.split(':').map(Number);
        
        const expectedMinutes = shiftHour * 60 + shiftMin;
        const actualMinutes = outHour * 60 + outMin;
        const earlyMinutes = Math.max(0, expectedMinutes - actualMinutes);
        const isEarly = earlyMinutes > 5;
        const overtimeMinutes = Math.max(0, actualMinutes - expectedMinutes);

        let newStatus = existingRecord.status;
        if (existingRecord.status === 'Present' && isEarly) {
          newStatus = 'Early Out';
        } else if (existingRecord.status === 'Late' && isEarly) {
          newStatus = 'Late & Early Out';
        }

        const { error: updateErr } = await supabase
          .from('attendance')
          .update({
            check_out: new Date().toISOString(),
            check_out_time: timeStr,
            check_out_selfie: selfieUrl,
            check_out_lat: lat,
            check_out_lng: lng,
            check_out_address: address,
            early_out_minutes: isEarly ? earlyMinutes : 0,
            overtime_minutes: overtimeMinutes,
            status: newStatus
          })
          .eq('id', existingRecord.id);

        if (updateErr) throw updateErr;

        return NextResponse.json({
          success: true,
          type: 'out',
          employeeName: user.name,
          time: timeStr,
          message: 'ڕۆشتنەکەت بە سەرکەوتوویی تۆمارکرا',
          date: dateStr,
          address
        });
      }
    }

    // ----------------------------------------
    // GET /api/attendance/daily-token
    // ----------------------------------------
    if (pathStr === 'daily-token' && method === 'GET') {
      return NextResponse.json({ token: getDailyToken() });
    }

    // ----------------------------------------
    // GET /api/attendance/employee/:id
    // ----------------------------------------
    if (path[0] === 'employee' && path[1] && method === 'GET') {
      const empId = path[1];
      const { data: records, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', empId);

      if (error) throw error;

      const formattedRecords = records.map(r => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        date: r.date,
        checkIn: r.check_in,
        checkInTime: r.check_in_time,
        checkInSelfie: r.check_in_selfie,
        checkOut: r.check_out,
        checkOutTime: r.check_out_time,
        checkOutSelfie: r.check_out_selfie,
        warehouseName: r.warehouse_name,
        lateMinutes: r.late_minutes,
        earlyOutMinutes: r.early_out_minutes,
        overtimeMinutes: r.overtime_minutes || 0,
        status: r.status
      }));

      return NextResponse.json(formattedRecords);
    }

    // ----------------------------------------
    // GET /api/attendance/admin/diagnose
    // ----------------------------------------
    if (pathStr === 'admin/diagnose' && method === 'GET') {
      const diagnostics = { databaseConnection: false, usersTableExists: false, error: null as any };
      try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) {
          diagnostics.error = error.message;
        } else {
          diagnostics.databaseConnection = true;
          diagnostics.usersTableExists = true;
        }
      } catch (err: any) {
        diagnostics.error = err.message;
      }
      return NextResponse.json(diagnostics);
    }

    // ----------------------------------------
    // GET /api/attendance/admin/report
    // ----------------------------------------
    if (pathStr === 'admin/report' && method === 'GET') {
      const { data: users } = await supabase.from('users').select('*');
      const { data: attendance } = await supabase.from('attendance').select('*');
      const { data: warehouses } = await supabase.from('warehouses').select('*');
      const { data: defaultShift } = await supabase.from('shifts').select('*').eq('id', 'default').maybeSingle();
      const { data: overrides } = await supabase.from('shift_overrides').select('*');

      let finalHolidays: any[] = [];
      try {
        const { data: holidays } = await supabase.from('holidays').select('*');
        finalHolidays = holidays || [];
      } catch (e) {}

      const formattedAttendance = (attendance || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        date: r.date,
        checkIn: r.check_in,
        checkInTime: r.check_in_time,
        checkInSelfie: r.check_in_selfie,
        checkInAddress: r.check_in_address || '',
        checkOut: r.check_out,
        checkOutTime: r.check_out_time,
        checkOutSelfie: r.check_out_selfie,
        checkOutAddress: r.check_out_address || '',
        warehouseId: r.warehouse_id,
        warehouseName: r.warehouse_name,
        lateMinutes: r.late_minutes,
        earlyOutMinutes: r.early_out_minutes,
        overtimeMinutes: r.overtime_minutes || 0,
        status: r.status
      }));

      const formattedOverrides: Record<string, any> = {};
      (overrides || []).forEach(o => {
        formattedOverrides[o.date] = { checkInTime: o.check_in_time, checkOutTime: o.check_out_time };
      });

      return NextResponse.json({
        users: (users || []).map(u => ({ id: u.id, name: u.name, pin: u.pin, deviceToken: u.device_token, role: u.role, hourlyRate: u.hourly_rate || 0 })),
        attendance: formattedAttendance,
        warehouses: warehouses || [],
        holidays: finalHolidays,
        shifts: {
          default: { checkInTime: defaultShift?.check_in_time || '08:30', checkOutTime: defaultShift?.check_out_time || '16:30' },
          overrides: formattedOverrides
        }
      });
    }

    // ----------------------------------------
    // Holidays CRUD
    // ----------------------------------------
    if (pathStr === 'admin/holidays' && method === 'GET') {
      const { data, error } = await supabase.from('holidays').select('*').order('date', { ascending: false });
      if (error) throw error;
      return NextResponse.json(data || []);
    }

    if (pathStr === 'admin/holidays' && method === 'POST') {
      const { name, date } = await req.json();
      if (!name || !date) return NextResponse.json({ error: 'ناو و ڕێككەوت پێویستن' }, { status: 400 });
      const id = 'hol-' + Math.random().toString(36).substring(2, 9);
      const { error } = await supabase.from('holidays').insert({ id, name, date, type: 'holiday' });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (path[0] === 'admin' && path[1] === 'holidays' && path[2] && method === 'DELETE') {
      const hId = path[2];
      const { error } = await supabase.from('holidays').delete().eq('id', hId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ----------------------------------------
    // POST /api/attendance/checkin/verify-pin
    // ----------------------------------------
    if (pathStr === 'checkin/verify-pin' && method === 'POST') {
      const { userId, pin } = await req.json();
      if (!userId || !pin) return NextResponse.json({ error: 'ئایدی و پین پێویستن' }, { status: 400 });

      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, role, pin')
        .eq('id', userId)
        .maybeSingle();

      if (error || !user) return NextResponse.json({ error: 'کارمەند نەدۆزرایەوە' }, { status: 401 });
      if (user.pin !== pin) return NextResponse.json({ error: 'پین کۆدەکە هەڵەیە' }, { status: 401 });

      return NextResponse.json({ user: { id: user.id, name: user.name, role: user.role } });
    }

    // ----------------------------------------
    // Admin Users CRUD
    // ----------------------------------------
    if (pathStr === 'admin/users' && method === 'POST') {
      const { id, name, pin, role, hourlyRate } = await req.json();
      if (!id || !name || !pin) return NextResponse.json({ error: 'تکایە هەموو خانەکان پڕ بکەرەوە' }, { status: 400 });

      const { error } = await supabase
        .from('users')
        .insert({ id, name, pin, role: role || 'employee', hourly_rate: parseFloat(hourlyRate) || 0 });

      if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'ئەم ناو مۆرکە (ID) پێشتر بەکارهاتووە' }, { status: 400 });
        throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (pathStr === 'admin/users/change-pin' && method === 'POST') {
      const { userId, newPin } = await req.json();
      if (!userId || !newPin) return NextResponse.json({ error: 'User ID and New PIN are required' }, { status: 400 });

      const { error } = await supabase.from('users').update({ pin: newPin }).eq('id', userId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (pathStr === 'admin/users/reset-device' && method === 'POST') {
      const { userId } = await req.json();
      if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

      const { error } = await supabase.from('users').update({ device_token: null }).eq('id', userId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (path[0] === 'admin' && path[1] === 'users' && path[2] && method === 'DELETE') {
      const uId = path[2];
      const { error } = await supabase.from('users').delete().eq('id', uId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (pathStr === 'admin/users/update-rate' && method === 'POST') {
      const { userId, hourlyRate } = await req.json();
      if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

      const { error } = await supabase.from('users').update({ hourly_rate: parseFloat(hourlyRate) || 0 }).eq('id', userId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (pathStr === 'admin/users/rename' && method === 'POST') {
      const { userId, name } = await req.json();
      if (!userId || !name) return NextResponse.json({ error: 'User ID and Name required' }, { status: 400 });

      const { error } = await supabase.from('users').update({ name }).eq('id', userId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ----------------------------------------
    // Biometrics (Fingerprint / Face ID) Endpoints
    // ----------------------------------------
    if (pathStr === 'biometrics/register' && method === 'POST') {
      const { userId, credentialId } = await req.json();
      if (!userId || !credentialId) return NextResponse.json({ error: 'userId and credentialId required' }, { status: 400 });

      const { error } = await supabase.from('users').update({ biometric_credential_id: credentialId }).eq('id', userId);
      if (error) {
        console.warn('Note: biometric_credential_id update in users table:', error.message);
      }
      return NextResponse.json({ success: true, credentialId });
    }

    if (pathStr === 'biometrics/status' && method === 'GET') {
      const userId = req.nextUrl.searchParams.get('userId');
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

      const { data: userRow } = await supabase.from('users').select('biometric_credential_id').eq('id', userId).maybeSingle();
      return NextResponse.json({
        hasBiometrics: !!userRow?.biometric_credential_id,
        credentialId: userRow?.biometric_credential_id || null,
      });
    }

    // ----------------------------------------
    // AI Face Recognition Endpoints (ڕوخسارناسینەوەی زیرەک)
    // ----------------------------------------
    if (pathStr === 'face/register' && method === 'POST') {
      const { userId, userName, descriptor } = await req.json();
      if (!userId || !descriptor) {
        return NextResponse.json({ error: 'userId and face descriptor required' }, { status: 400 });
      }

      // 1. Save to Central Resilient Supabase Store (warehouses table -> qr_code column)
      let registry: Record<string, any> = {};
      try {
        const { data: regRow } = await supabase
          .from('warehouses')
          .select('*')
          .eq('id', 'ashley_face_registry')
          .maybeSingle();

        if (regRow?.qr_code) {
          try {
            registry = JSON.parse(regRow.qr_code);
          } catch {
            registry = {};
          }
        }

        registry[userId] = {
          id: userId,
          name: userName || registry[userId]?.name || 'کارمەند',
          descriptor: descriptor,
          updatedAt: new Date().toISOString(),
        };

        const registryJson = JSON.stringify(registry);

        const { error: upsertErr } = await supabase.from('warehouses').upsert({
          id: 'ashley_face_registry',
          name: 'Ashley AI Face Database Registry',
          qr_code: registryJson,
          lat: 0,
          lng: 0,
          radius: 0,
        });

        if (upsertErr) {
          console.error('Supabase face upsert error:', upsertErr);
        }
      } catch (err: any) {
        console.error('Error saving to resilient face registry:', err);
      }

      // 2. Secondary backup update to users table
      try {
        const descriptorJson = JSON.stringify(descriptor);
        await supabase
          .from('users')
          .update({ face_descriptor: descriptorJson })
          .eq('id', userId);
      } catch (updErr: any) {
        console.warn('Note: users table update ignored:', updErr.message);
      }

      return NextResponse.json({
        success: true,
        message: 'ڕوخسار بە سەرکەوتوویی لە سیستەم و سێرڤەر تۆمارکرا',
        totalRegistered: Object.keys(registry).length,
      });
    }

    if (pathStr === 'face/status' && method === 'GET') {
      const userId = req.nextUrl.searchParams.get('userId');
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

      // Check central resilient store first
      try {
        const { data: regRow } = await supabase
          .from('warehouses')
          .select('*')
          .eq('id', 'ashley_face_registry')
          .maybeSingle();

        if (regRow?.qr_code) {
          const registry = JSON.parse(regRow.qr_code);
          if (registry[userId]?.descriptor) {
            return NextResponse.json({
              hasFaceRegistered: true,
              descriptor: registry[userId].descriptor,
              name: registry[userId].name,
            });
          }
        }
      } catch (err) {
        console.warn('Registry read fallback:', err);
      }

      // Fallback to users table
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('face_descriptor')
          .eq('id', userId)
          .maybeSingle();

        let descriptor: number[] | null = null;
        if (userRow?.face_descriptor) {
          descriptor = typeof userRow.face_descriptor === 'string'
            ? JSON.parse(userRow.face_descriptor)
            : userRow.face_descriptor;
        }

        return NextResponse.json({
          hasFaceRegistered: !!descriptor && descriptor.length > 0,
          descriptor,
        });
      } catch {
        return NextResponse.json({ hasFaceRegistered: false });
      }
    }

    if (pathStr === 'face/all' && method === 'GET') {
      let registeredMap: Record<string, any> = {};

      // 1. Read from central resilient registry (warehouses table -> qr_code)
      try {
        const { data: regRow } = await supabase
          .from('warehouses')
          .select('*')
          .eq('id', 'ashley_face_registry')
          .maybeSingle();

        if (regRow?.qr_code) {
          registeredMap = JSON.parse(regRow.qr_code);
        }
      } catch (err) {
        console.warn('Error reading central face registry:', err);
      }

      // 2. Also merge any from users table
      try {
        const { data: usersList } = await supabase
          .from('users')
          .select('id, name, full_name, face_descriptor')
          .not('face_descriptor', 'is', null);

        (usersList || []).forEach((u: any) => {
          if (!registeredMap[u.id] && u.face_descriptor) {
            try {
              const desc = typeof u.face_descriptor === 'string' ? JSON.parse(u.face_descriptor) : u.face_descriptor;
              if (Array.isArray(desc) && desc.length > 0) {
                registeredMap[u.id] = {
                  id: u.id,
                  name: u.full_name || u.name,
                  descriptor: desc,
                };
              }
            } catch {}
          }
        });
      } catch {}

      const employeesList = Object.values(registeredMap);

      return NextResponse.json(
        { success: true, count: employeesList.length, employees: employeesList },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'CDN-Cache-Control': 'no-store',
          },
        }
      );
    }

    // ----------------------------------------
    // Company Geofence Location Sync (Global across all devices)
    // ----------------------------------------
    if (pathStr === 'location' && method === 'GET') {
      // 1. Try to get main designated factory warehouse
      let { data: wh } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', 'main-company-location')
        .maybeSingle();

      // 2. Fallback to any warehouse
      if (!wh) {
        const { data: firstWh } = await supabase
          .from('warehouses')
          .select('*')
          .limit(1)
          .maybeSingle();
        wh = firstWh;
      }

      const noCacheHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      };

      if (wh && wh.lat && wh.lng) {
        return NextResponse.json(
          {
            name: wh.name || 'کۆمپانیای سەرەکی ئاشڵی',
            lat: parseFloat(wh.lat) || 35.5571,
            lng: parseFloat(wh.lng) || 45.4352,
            radiusMeters: parseInt(wh.radius) || 50,
          },
          { headers: noCacheHeaders }
        );
      }

      return NextResponse.json(
        {
          name: 'کۆمپانیای سەرەکی ئاشڵی (Ashley Company Base)',
          lat: 35.5571,
          lng: 45.4352,
          radiusMeters: 50,
        },
        { headers: noCacheHeaders }
      );
    }

    if (pathStr === 'location' && method === 'POST') {
      const { name, lat, lng, radiusMeters } = await req.json();
      if (!lat || !lng) return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });

      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      const parsedRadius = parseInt(radiusMeters) || 50;
      const parsedName = name || 'کۆمپانیای سەرەکی ئاشڵی';

      // Upsert designated warehouse
      const { error: upsertErr } = await supabase.from('warehouses').upsert({
        id: 'main-company-location',
        name: parsedName,
        lat: parsedLat,
        lng: parsedLng,
        radius: parsedRadius,
        qr_code: 'https://ashley-staff.vercel.app',
      });

      if (upsertErr) {
        console.error('Error upserting main warehouse location:', upsertErr);
        // Fallback update all existing rows
        await supabase.from('warehouses').update({
          name: parsedName,
          lat: parsedLat,
          lng: parsedLng,
          radius: parsedRadius,
        }).neq('id', '___none___');
      }

      const noCacheHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      };

      return NextResponse.json(
        {
          success: true,
          location: { name: parsedName, lat: parsedLat, lng: parsedLng, radiusMeters: parsedRadius },
        },
        { headers: noCacheHeaders }
      );
    }

    if (pathStr === 'admin/users/update-role' && method === 'POST') {
      const { userId, role } = await req.json();
      if (!userId || !role) return NextResponse.json({ error: 'userId and role required' }, { status: 400 });
      if (userId === 'admin') return NextResponse.json({ error: 'Cannot change root admin' }, { status: 400 });

      const { error } = await supabase.from('users').update({ role }).eq('id', userId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ----------------------------------------
    // Admin Warehouses CRUD
    // ----------------------------------------
    if (pathStr === 'admin/warehouses' && method === 'POST') {
      const { name, lat, lng, radius } = await req.json();
      if (!name || !lat || !lng) return NextResponse.json({ error: 'تکایە هەموو خانەکان پڕ بکەرەوە' }, { status: 400 });

      const id = 'wh-' + Math.random().toString(36).substring(2, 9);
      const currentHost = req.headers.get('host') || 'localhost:3000';
      const referer = req.headers.get('referer') || '';
      const protocol = referer.startsWith('https') ? 'https' : 'http';
      const qrCode = `${protocol}://${currentHost}/attendance/checkin?wh=${id}`;

      const { error } = await supabase
        .from('warehouses')
        .insert({
          id,
          name,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radius: parseInt(radius) || 50,
          qr_code: qrCode
        });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (path[0] === 'admin' && path[1] === 'warehouses' && path[2] && method === 'DELETE') {
      const wId = path[2];
      const { error } = await supabase.from('warehouses').delete().eq('id', wId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (path[0] === 'admin' && path[1] === 'warehouses' && path[2] && method === 'PUT') {
      const wId = path[2];
      const { name, lat, lng, radius } = await req.json();
      if (!name || !lat || !lng) return NextResponse.json({ error: 'تکایە هەموو خانەکان پڕ بکەرەوە' }, { status: 400 });

      const { error } = await supabase
        .from('warehouses')
        .update({
          name,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radius: parseInt(radius) || 50
        })
        .eq('id', wId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ----------------------------------------
    // GET /api/attendance/logs (Supabase Clean Attendance Logs Fetch)
    // ----------------------------------------
    if (pathStr === 'logs' && method === 'GET') {
      try {
        const formattedLogs: any[] = [];

        // 1. Try reading from primary `attendance_logs` table
        const { data: logs1 } = await supabase
          .from('attendance_logs')
          .select('*')
          .order('created_at', { ascending: false });

        if (logs1 && logs1.length > 0) {
          logs1.forEach((r: any) => {
            formattedLogs.push({
              id: r.id,
              employeeId: r.employee_id || r.user_id,
              userId: r.employee_id || r.user_id,
              userName: r.employee_name || r.user_name,
              name: r.employee_name || r.user_name,
              type: r.log_type === 'Check Out' || r.type?.includes('Out') ? 'دەرچوون (Check Out)' : 'هاتن (Check In)',
              time: `${r.log_date || r.date} ${r.log_time_str || r.time || '08:00'}`,
              distance: r.location_address || 'داخل کۆمپانیا',
              selfieUrl: r.selfie_url || r.check_in_selfie || r.check_out_selfie,
              checkInSelfie: r.selfie_url || r.check_in_selfie,
              checkOutSelfie: r.selfie_url || r.check_out_selfie,
              status: 'verified',
              createdAt: r.created_at || `${r.log_date} ${r.log_time_str}`,
              originalTime: r.original_time || undefined,
              editNote: r.edit_note || undefined,
            });
          });
        }

        // 2. Also read from `attendance` table for backward compatibility
        const { data: logs2 } = await supabase
          .from('attendance')
          .select('*')
          .order('date', { ascending: false });

        if (logs2 && logs2.length > 0) {
          logs2.forEach((r: any) => {
            if (r.check_in_time) {
              formattedLogs.push({
                id: `${r.id}-in`,
                employeeId: r.user_id,
                userId: r.user_id,
                userName: r.user_name,
                name: r.user_name,
                type: 'هاتن (Check In)',
                time: `${r.date} ${r.check_in_time}`,
                distance: r.check_in_address || 'داخل کۆمپانیا',
                selfieUrl: r.check_in_selfie,
                checkInSelfie: r.check_in_selfie,
                status: 'verified',
                createdAt: r.check_in || `${r.date} ${r.check_in_time}`,
                originalTime: r.check_in_original_time || undefined,
                editNote: r.check_in_edit_note || undefined,
              });
            }
            if (r.check_out_time) {
              formattedLogs.push({
                id: `${r.id}-out`,
                employeeId: r.user_id,
                userId: r.user_id,
                userName: r.user_name,
                name: r.user_name,
                type: 'دەرچوون (Check Out)',
                time: `${r.date} ${r.check_out_time}`,
                distance: r.check_out_address || 'داخل کۆمپانیا',
                selfieUrl: r.check_out_selfie,
                checkOutSelfie: r.check_out_selfie,
                status: 'verified',
                createdAt: r.check_out || `${r.date} ${r.check_out_time}`,
                originalTime: r.check_out_original_time || undefined,
                editNote: r.check_out_edit_note || undefined,
              });
            }
          });
        }

        // Remove duplicates by ID
        const uniqueMap = new Map();
        formattedLogs.forEach(item => uniqueMap.set(item.id, item));

        return NextResponse.json(Array.from(uniqueMap.values()));
      } catch (err) {
        return NextResponse.json([]);
      }
    }

    // ----------------------------------------
    // POST /api/attendance/logs (Insert to Supabase DB & Storage)
    // ----------------------------------------
    if (pathStr === 'logs' && method === 'POST') {
      const body = await req.json();
      const { employeeId, userId, name, userName, type, log_type, time, selfieUrl, distance } = body;

      const empId = employeeId || userId || 'emp';
      const empName = name || userName || 'Employee';
      const dateStr = time?.split(' ')[0] || new Date().toISOString().split('T')[0];
      const timeStr = time?.split(' ')[1]?.slice(0, 5) || new Date().toTimeString().slice(0, 5);
      const isCheckOut = type?.includes('Out') || type?.includes('دەرچوون') || log_type === 'Check Out';

      let publicSelfieUrl = selfieUrl;
      if (selfieUrl && typeof selfieUrl === 'string' && selfieUrl.startsWith('data:image')) {
        const uploaded = await uploadSelfieToStorage(
          empId, 
          dateStr, 
          isCheckOut ? 'out' : 'in', 
          selfieUrl
        );
        if (uploaded) publicSelfieUrl = uploaded;
      }

      const logRecordId = `log-${empId}-${dateStr}-${isCheckOut ? 'out' : 'in'}-${Date.now().toString().slice(-4)}`;

      // 1. Insert into primary `attendance_logs` table
      let hasError = false;
      let errorMsg = '';
      try {
        const { error } = await supabase.from('attendance_logs').insert({
          id: logRecordId,
          employee_id: empId,
          employee_name: empName,
          log_type: isCheckOut ? 'Check Out' : 'Check In',
          log_date: dateStr,
          log_time_str: timeStr,
          selfie_url: publicSelfieUrl,
          location_address: distance || 'داخل کۆمپانیا',
          created_at: new Date().toISOString()
        });
        if (error) throw error;
      } catch (e: any) {
        console.error('Notice inserting to attendance_logs:', e);
        hasError = true;
        errorMsg = e.message || 'Supabase Insert Error';
      }

      // 2. Insert/Upsert into `attendance` table for backward compatibility
      const rowId = `att-${empId}-${dateStr}`;
      const { data: existingRecord } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', empId)
        .eq('date', dateStr)
        .maybeSingle();

      let upsertPayload: any = {
        id: existingRecord?.id || rowId,
        user_id: empId,
        user_name: empName,
        date: dateStr,
        status: 'Present'
      };

      if (isCheckOut) {
        upsertPayload.check_out = new Date().toISOString();
        upsertPayload.check_out_time = timeStr;
        upsertPayload.check_out_selfie = publicSelfieUrl;
        upsertPayload.check_out_address = distance || 'داخل کۆمپانیا';
      } else {
        upsertPayload.check_in = new Date().toISOString();
        upsertPayload.check_in_time = timeStr;
        upsertPayload.check_in_selfie = publicSelfieUrl;
        upsertPayload.check_in_address = distance || 'داخل کۆمپانیا';
      }

      try {
        const { error } = await supabase.from('attendance').upsert(upsertPayload);
        if (error) throw error;
      } catch (e: any) {
        console.error('Notice upserting to attendance:', e);
        hasError = true;
        errorMsg = e.message || 'Supabase Upsert Error';
      }

      if (hasError) {
        return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        record: { 
          ...body, 
          id: logRecordId,
          selfieUrl: publicSelfieUrl, 
          checkInSelfie: !isCheckOut ? publicSelfieUrl : undefined,
          checkOutSelfie: isCheckOut ? publicSelfieUrl : undefined
        } 
      });
    }

    // ----------------------------------------
    // DELETE /api/attendance/logs/:id OR DELETE /api/attendance/logs (Purge)
    // ----------------------------------------
    if (pathStr === 'logs' && method === 'DELETE') {
      try {
        await supabase.from('attendance_logs').delete().neq('id', '000');
        await supabase.from('attendance').delete().neq('id', '000');
        return NextResponse.json({ success: true, message: 'All attendance records successfully purged from Supabase' });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    if ((params.path || [])[0] === 'logs' && (params.path || [])[1] && method === 'DELETE') {
      try {
        const logId = (params.path || [])[1];
        const searchParams = req.nextUrl.searchParams;
        const employeeId = searchParams.get('employeeId');
        const dateStr = searchParams.get('dateStr');
        const logType = searchParams.get('logType');

        // 1. Delete from attendance_logs
        await supabase.from('attendance_logs').delete().eq('id', logId);

        // 2. Also delete/clear from attendance table if employeeId and dateStr are provided
        if (employeeId && dateStr) {
          const isCheckOut = logType?.includes('Out') || logType?.includes('دەرچوون');
          if (isCheckOut) {
            await supabase.from('attendance_logs').delete().eq('employee_id', employeeId).eq('log_date', dateStr).eq('log_type', 'Check Out');
            await supabase.from('attendance').update({
              check_out: null,
              check_out_time: null,
              check_out_selfie: null,
              check_out_original_time: null,
              check_out_edit_note: null,
            }).eq('user_id', employeeId).eq('date', dateStr);
          } else {
            await supabase.from('attendance_logs').delete().eq('employee_id', employeeId).eq('log_date', dateStr).eq('log_type', 'Check In');
            await supabase.from('attendance').update({
              check_in: null,
              check_in_time: null,
              check_in_selfie: null,
              check_in_original_time: null,
              check_in_edit_note: null,
            }).eq('user_id', employeeId).eq('date', dateStr);
          }
        }

        // 3. Composite ID handling
        if (logId.endsWith('-in')) {
          const rawId = logId.replace('-in', '');
          await supabase.from('attendance').update({ check_in_time: null, check_in: null, check_in_selfie: null }).eq('id', rawId);
        } else if (logId.endsWith('-out')) {
          const rawId = logId.replace('-out', '');
          await supabase.from('attendance').update({ check_out_time: null, check_out: null, check_out_selfie: null }).eq('id', rawId);
        } else {
          await supabase.from('attendance').delete().eq('id', logId);
        }

        return NextResponse.json({ success: true, message: 'Attendance record deleted' });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    // ----------------------------------------
    // PATCH /api/attendance/logs/:id (Edit Time)
    // ----------------------------------------
    if ((params.path || [])[0] === 'logs' && (params.path || [])[1] && method === 'PATCH') {
      try {
        const logId = (params.path || [])[1];
        const body = await req.json();
        const { newTime, note, logType, employeeId, dateStr, oldTime } = body;
        
        if (!newTime || !note) {
           return NextResponse.json({ error: 'newTime and note are required' }, { status: 400 });
        }

        await supabase.from('attendance_logs').update({
           original_time: oldTime || '08:00',
           log_time_str: newTime,
           edit_note: note
        }).eq('id', logId);

        if (employeeId && dateStr) {
           const { data: attRecord } = await supabase.from('attendance').select('*').eq('user_id', employeeId).eq('date', dateStr).maybeSingle();
           if (attRecord) {
              const isCheckOut = logType?.includes('Out') || logType?.includes('دەرچوون');
              if (isCheckOut) {
                 await supabase.from('attendance').update({
                   check_out_original_time: attRecord.check_out_original_time || attRecord.check_out_time,
                   check_out_time: newTime,
                   check_out_edit_note: note
                 }).eq('id', attRecord.id);
              } else {
                 await supabase.from('attendance').update({
                   check_in_original_time: attRecord.check_in_original_time || attRecord.check_in_time,
                   check_in_time: newTime,
                   check_in_edit_note: note
                 }).eq('id', attRecord.id);
              }
           }
        }
        return NextResponse.json({ success: true });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
      }
    }

    if (pathStr === 'status' && method === 'GET') {
      try {
        const { data: attData, error: attErr } = await supabase.from('attendance').select('id', { count: 'exact' }).limit(1);
        const { data: logsData, error: logsErr } = await supabase.from('attendance_logs').select('id', { count: 'exact' }).limit(1);

        return NextResponse.json({
          status: 'online',
          supabaseUrl,
          hasAnonKey: !!supabaseKey,
          attendanceTable: attErr ? `Error: ${attErr.message}` : `OK (${attData?.length || 0} sample rows)`,
          attendanceLogsTable: logsErr ? `Error: ${logsErr.message}` : `OK (${logsData?.length || 0} sample rows)`,
        });
      } catch (err: any) {
        return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
      }
    }

    // fallback 404
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });

  } catch (err: any) {
    console.error('API Route Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ path?: string[] }> }) { return handle(req, props); }
export async function POST(req: NextRequest, props: { params: Promise<{ path?: string[] }> }) { return handle(req, props); }
export async function PUT(req: NextRequest, props: { params: Promise<{ path?: string[] }> }) { return handle(req, props); }
export async function PATCH(req: NextRequest, props: { params: Promise<{ path?: string[] }> }) { return handle(req, props); }
export async function DELETE(req: NextRequest, props: { params: Promise<{ path?: string[] }> }) { return handle(req, props); }
