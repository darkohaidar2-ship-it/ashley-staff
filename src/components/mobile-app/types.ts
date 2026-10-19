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
  totalOvertimeMinutes: number;
  totalLateMinutes: number;
  records: Array<{
    date: string;
    check_in_time: string | null;
    check_out_time: string | null;
    status: string;
    overtime_minutes?: number;
    late_minutes?: number;
    check_out_note?: string;
  }>;
}
