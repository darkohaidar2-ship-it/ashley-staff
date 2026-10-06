export interface DayPunchRecord {
  date: string;
  dayName: string;
  checkIn: string | null;
  checkOut: string | null;
  durationMinutes: number;
  durationStr: string;
  lateMinutes: number;
  overtimeMinutes: number;
  status: 'Present' | 'Absent' | 'Leave' | 'Holiday' | 'Incomplete';
  locationName: string;
}

export interface MonthlyAttendanceStats {
  monthStr: string;
  employeeId: string;
  employeeName: string;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  holidayDays: number;
  totalWorkMinutes: number;
  totalWorkHoursStr: string;
  totalLateMinutes: number;
  totalLateStr: string;
  totalOvertimeMinutes: number;
  totalOvertimeStr: string;
  targetWorkingDays: number;
  attendancePercent: number;
  records: DayPunchRecord[];
}

// Convert minutes to Kurdish readable string (e.g. 14 کاتژمێر و ٢٠ خولەک)
export function formatMinutesToKurdish(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '٠ خولەک';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} کاتژمێر و ${minutes} خولەک`;
  }
  if (hours > 0) {
    return `${hours} کاتژمێر`;
  }
  return `${minutes} خولەک`;
}

// Calculate previous month string (e.g. 2026-10 -> 2026-09)
export function getPreviousMonthStr(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Calculate next month string (e.g. 2026-10 -> 2026-11)
export function getNextMonthStr(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Format month name in Kurdish (e.g. 2026-10 -> تشرینی یەکەم ٢٠٢٦)
export function formatKurdishMonthName(monthStr: string): string {
  const monthNames: Record<string, string> = {
    '01': 'کانوونی دووەم (مانگی ١)',
    '02': 'شوبات (مانگی ٢)',
    '03': 'ئازار (مانگی ٣)',
    '04': 'نیسان (مانگی ٤)',
    '05': 'ئایار (مانگی ٥)',
    '06': 'حوزەیران (مانگی ٦)',
    '07': 'تەمووز (مانگی ٧)',
    '08': 'ئاب (مانگی ٨)',
    '09': 'ئەیلوول (مانگی ٩)',
    '10': 'تشرینی یەکەم (مانگی ١٠)',
    '11': 'تشرینی دووەم (مانگی ١١)',
    '12': 'کانوونی یەکەم (مانگی ١٢)',
  };
  const parts = monthStr.split('-');
  const name = monthNames[parts[1]] || parts[1];
  return `${name} ${parts[0]}`;
}

// Kurdish Day Names
export function getKurdishDayName(dateString: string): string {
  const days = ['یەکشەممە', 'دووشەممە', 'سێشەممە', 'چوارشەممە', 'پێنجشەممە', 'هەینی', 'شەممە'];
  const d = new Date(dateString + 'T12:00:00Z');
  return days[d.getUTCDay()] || '';
}
