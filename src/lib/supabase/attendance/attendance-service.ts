import { supabase } from '@/lib/supabase/client';
import type { AttendanceRecord } from '@/lib/types';

export async function fetchAttendanceLogs(): Promise<AttendanceRecord[]> {
  try {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[AttendanceService] Error fetching attendance_logs:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      userId: row.employee_id,
      employeeId: row.employee_id,
      employeeName: row.employee_name || row.user_name || '',
      logType: row.log_type,
      logDate: row.log_date,
      date: row.log_date,
      time: row.log_time_str,
      checkInTime: row.log_type === 'check_in' || row.log_type === 'In' ? row.log_time_str : undefined,
      checkOutTime: row.log_type === 'check_out' || row.log_type === 'Out' ? row.log_time_str : undefined,
      selfieUrl: row.selfie_url,
      locationAddress: row.location_address,
      warehouseName: row.location_address || '',
      createdAt: row.created_at,
      originalTime: row.original_time,
      editNote: row.edit_note,
      status: 'present',
    })) as AttendanceRecord[];
  } catch (err) {
    console.error('[AttendanceService] Exception fetching attendance logs:', err);
    return [];
  }
}

export async function fetchDailyAttendance(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .order('date', { ascending: false })
      .limit(500);

    if (error) {
      console.error('[AttendanceService] Error fetching attendance records:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[AttendanceService] Exception fetching attendance records:', err);
    return [];
  }
}

export async function fetchLocations(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .not('lat', 'is', null);

    if (error) {
      console.error('[AttendanceService] Error fetching warehouse locations:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[AttendanceService] Exception fetching warehouse locations:', err);
    return [];
  }
}
