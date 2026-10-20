export interface MobileAuthUser {
  email: string;
  employeeId: string;
  employeeName: string;
  role: string;
  photoUrl?: string;
  googleUid?: string;
  phone?: string;
  loginTime: string;
  isFounder?: boolean;
}

export interface GeofenceStatus {
  isChecking: boolean;
  isInside: boolean;
  distanceMeters: number;
  closestLocationName: string;
  allowedRadiusMeters: number;
  lat?: number;
  lng?: number;
  error?: string;
}

export interface TodayAttendanceInfo {
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  overtimeNote: string | null;
  date: string;
}

export interface MonthStatsInfo {
  month: string;
  presentDays: number;
  absentDays?: number;
  leaveDays?: number;
  holidayDays?: number;
  totalWorkMinutes?: number;
  totalWorkHoursStr?: string;
  totalOvertimeMinutes: number;
  totalOvertimeStr?: string;
  totalLateMinutes: number;
  totalLateStr?: string;
  targetWorkingDays?: number;
  attendancePercent?: number;
  records: Array<{
    date: string;
    dayName?: string;
    check_in_time: string | null;
    check_out_time: string | null;
    status: string;
    duration_minutes?: number;
    duration_str?: string;
    overtime_minutes?: number;
    late_minutes?: number;
    check_out_note?: string;
    location_name?: string;
  }>;
}
