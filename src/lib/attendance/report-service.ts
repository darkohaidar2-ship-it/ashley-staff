import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { getBaghdadNow } from '@/lib/telegram/telegram-service';

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

// Parse HH:MM into minutes from midnight
function timeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || !timeStr.includes(':')) return null;
  const parts = timeStr.split(':').map(Number);
  if (isNaN(parts[0]) || isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

// ---------------------------------------------------------------------------
// 1. EVALUATE COMPLETE MONTHLY ATTENDANCE STATS & DETAILS
// ---------------------------------------------------------------------------
export async function getMonthlyAttendanceStats(
  employeeId: string,
  employeeName: string,
  targetMonth?: string
): Promise<MonthlyAttendanceStats> {
  const { dateStr } = getBaghdadNow();
  const monthStr = targetMonth || dateStr.slice(0, 7);

  // Read attendance records from Supabase
  const { data: monthRecords } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', employeeId)
    .ilike('date', `${monthStr}%`)
    .order('date', { ascending: true });

  // Read manual overrides from warehouses table
  let manualMap: Record<string, any> = {};
  try {
    const { data: setRow } = await supabase
      .from('warehouses')
      .select('qr_code')
      .eq('id', 'ashley_manual_attendance_records')
      .maybeSingle();
    if (setRow?.qr_code) {
      manualMap = typeof setRow.qr_code === 'string' ? JSON.parse(setRow.qr_code) : setRow.qr_code;
    }
  } catch (err) {
    logger.warn('[ReportService] Error reading manual overrides:', err);
  }

  const cleanId = employeeId.replace(/^emp-0*/i, '') || employeeId.replace('emp-', '');
  const cleanPadded = cleanId.length === 1 ? `0${cleanId}` : cleanId;

  // Merge into a date-based map
  const recordsMap = new Map<string, any>();
  (monthRecords || []).forEach(r => recordsMap.set(r.date, r));

  for (const [key, val] of Object.entries<any>(manualMap)) {
    if (!key.includes(monthStr)) continue;
    if (
      key.startsWith(`${employeeId}_`) ||
      key.startsWith(`${cleanId}_`) ||
      key.startsWith(`${cleanPadded}_`) ||
      key.startsWith(`emp-${cleanPadded}_`) ||
      key.startsWith(`${employeeName}_`)
    ) {
      const d = val.date || key.split('_')[1];
      if (d) {
        recordsMap.set(d, { ...(recordsMap.get(d) || {}), ...val, date: d });
      }
    }
  }

  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let holidayDays = 0;
  let totalWorkMinutes = 0;
  let totalLateMinutes = 0;
  let totalOvertimeMinutes = 0;

  const sortedDates = Array.from(recordsMap.keys()).sort();
  const dayRecords: DayPunchRecord[] = [];

  for (const d of sortedDates) {
    const r = recordsMap.get(d);
    if (!r) continue;

    const isDel = r.status === 'empty' || r.action === 'delete';
    if (isDel) continue;

    const rawStatus = (r.status || 'Present').trim();
    const inTime = r.checkInTime || r.check_in_time || null;
    const outTime = r.checkOutTime || r.check_out_time || null;
    const locName = r.warehouse_name || r.warehouseName || r.check_in_address || 'کۆمپانیای سەرەکی ئاشڵی';

    let dayStatus: DayPunchRecord['status'] = 'Present';
    let durationMins = 0;
    let lateMins = 0;
    let otMins = 0;

    if (rawStatus === 'Absent' || rawStatus === 'غیاب') {
      dayStatus = 'Absent';
      absentDays++;
    } else if (rawStatus === 'Leave' || rawStatus === 'مۆڵەت') {
      dayStatus = 'Leave';
      leaveDays++;
    } else if (rawStatus === 'Holiday' || rawStatus === 'پشوو') {
      dayStatus = 'Holiday';
      holidayDays++;
    } else if (inTime || outTime) {
      presentDays++;
      const inM = timeToMinutes(inTime);
      const outM = timeToMinutes(outTime);

      if (inM !== null && outM !== null && outM > inM) {
        durationMins = outM - inM;
        totalWorkMinutes += durationMins;
      }

      // Check Late arrival (Shift starts 08:00, Grace 15 mins -> after 08:15)
      const officialStartM = 8 * 60; // 08:00
      const graceEndM = 8 * 60 + 15; // 08:15
      if (inM !== null && inM > graceEndM) {
        lateMins = inM - officialStartM;
        totalLateMinutes += lateMins;
      }

      // Check Overtime (Shift ends 17:00 -> after 17:00)
      const officialEndM = 17 * 60; // 17:00
      if (outM !== null && outM > officialEndM) {
        otMins = outM - officialEndM;
        totalOvertimeMinutes += otMins;
      }

      if (!inTime || !outTime) {
        dayStatus = 'Incomplete';
      }
    }

    dayRecords.push({
      date: d,
      dayName: getKurdishDayName(d),
      checkIn: inTime,
      checkOut: outTime,
      durationMinutes: durationMins,
      durationStr: formatMinutesToKurdish(durationMins),
      lateMinutes: lateMins,
      overtimeMinutes: otMins,
      status: dayStatus,
      locationName: locName,
    });
  }

  return {
    monthStr,
    employeeId,
    employeeName,
    presentDays,
    absentDays,
    leaveDays,
    holidayDays,
    totalWorkMinutes,
    totalWorkHoursStr: formatMinutesToKurdish(totalWorkMinutes),
    totalLateMinutes,
    totalLateStr: formatMinutesToKurdish(totalLateMinutes),
    totalOvertimeMinutes,
    totalOvertimeStr: formatMinutesToKurdish(totalOvertimeMinutes),
    records: dayRecords,
  };
}

// ---------------------------------------------------------------------------
// 2. FORMAT RICH KURDISH SORANI TEXT MESSAGE FOR TELEGRAM
// ---------------------------------------------------------------------------
export function formatMonthlyReportMessage(stats: MonthlyAttendanceStats): string {
  const kurdishMonth = formatKurdishMonthName(stats.monthStr);

  let msg = `📅 <b>ڕاپۆرتی فەرمی دەوامی مانگانە</b>\n`;
  msg += `🗓️ مانگ: <b>${kurdishMonth}</b>\n\n`;
  msg += `👤 کارمەند: <b>${stats.employeeName}</b>\n`;
  msg += `🆔 کۆدی کارمەند: <b>${stats.employeeId}</b>\n`;
  msg += `🏢 کۆمپانیای ئاشڵی بۆ مۆبیلیات\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📊 <b>ئاماری گشتی دەوام:</b>\n`;
  msg += `• 🟢 ڕۆژانی ئامادەبوو: <b>${stats.presentDays}</b> ڕۆژ\n`;
  msg += `• ⏱️ کۆی کاتژمێری کارکردن: <b>${stats.totalWorkHoursStr}</b>\n`;
  msg += `• ⭐ کاتژمێری ئۆڤەرتایم: <b>${stats.totalOvertimeStr}</b>\n`;
  if (stats.totalLateMinutes > 0) {
    msg += `• ⚠️ کۆی دواکەوتن (درەنگ): <b>${stats.totalLateStr}</b>\n`;
  }
  if (stats.leaveDays > 0) {
    msg += `• 🏖️ ڕۆژانی مۆڵەت: <b>${stats.leaveDays}</b> ڕۆژ\n`;
  }
  if (stats.absentDays > 0) {
    msg += `• ❌ ڕۆژانی غیاب: <b>${stats.absentDays}</b> ڕۆژ\n`;
  }
  msg += `\n━━━━━━━━━━━━━━━━━━━━━\n`;

  if (stats.records.length > 0) {
    msg += `📋 <b>وردەکاری ڕۆژەکان:</b>\n`;
    for (const r of stats.records) {
      const inText = r.checkIn ? `🟢 ${r.checkIn}` : '⚪ --:--';
      const outText = r.checkOut ? `🔴 ${r.checkOut}` : '⚪ --:--';
      const shortDate = r.date.slice(5);

      if (r.status === 'Absent') {
        msg += `❌ <b>${shortDate} (${r.dayName})</b>: غیاب\n`;
      } else if (r.status === 'Leave') {
        msg += `🏖️ <b>${shortDate} (${r.dayName})</b>: مۆڵەتی فەرمی\n`;
      } else if (r.status === 'Holiday') {
        msg += `🌴 <b>${shortDate} (${r.dayName})</b>: پشووی فەرمی\n`;
      } else {
        let extra = '';
        if (r.overtimeMinutes > 0) extra += ` (+${r.overtimeMinutes}خ ئەزافی)`;
        if (r.lateMinutes > 0) extra += ` (⚠️ ${r.lateMinutes}خ درەنگ)`;
        msg += `📅 <b>${shortDate}</b>: [${inText} | ${outText}]${extra}\n`;
      }
    }
  } else {
    msg += `<i>تا ئێستا هیچ تۆمارێکی دەوام بۆ ئەم مانگە نییە.</i>\n`;
  }

  msg += `\n✨ <i>دەتوانیت لە ڕێگەی دوگمەکانی خوارەوە مانگەکان بگۆڕیت یان فایلی فەرمی PDF دابەزێنیت:</i>`;
  return msg;
}

// ---------------------------------------------------------------------------
// 3. INLINE KEYBOARD FOR MONTH NAVIGATION & PDF DOWNLOAD
// ---------------------------------------------------------------------------
export function getMonthlyReportInlineKeyboard(monthStr: string) {
  const prevMonth = getPreviousMonthStr(monthStr);
  const nextMonth = getNextMonthStr(monthStr);

  return {
    inline_keyboard: [
      [
        { text: '◀️ مانگی پێشوو', callback_data: `month:${prevMonth}` },
        { text: `📅 ${monthStr}`, callback_data: `month:${monthStr}` },
        { text: 'مانگی دواتر ▶️', callback_data: `month:${nextMonth}` },
      ],
      [
        { text: '📥 داگرتنی پسوولەی فەرمی دەوام (PDF)', callback_data: `pdf:${monthStr}` },
      ],
    ],
  };
}

// ---------------------------------------------------------------------------
// 4. GENERATE ELEGANT OFFICIAL PDF REPORT USING JSPDF & NRT KURDISH FONT
// ---------------------------------------------------------------------------
export async function generateMonthlyAttendancePdf(stats: MonthlyAttendanceStats): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Load Kurdish NRT Font from public/fonts
  try {
    const fontRegPath = path.join(process.cwd(), 'public', 'fonts', 'NRT-Reg.ttf');
    const fontBdPath = path.join(process.cwd(), 'public', 'fonts', 'NRT-Bd.ttf');

    if (fs.existsSync(fontRegPath)) {
      const regBuf = fs.readFileSync(fontRegPath);
      doc.addFileToVFS('NRT-Reg.ttf', regBuf.toString('base64'));
      doc.addFont('NRT-Reg.ttf', 'NRT', 'normal');
    }
    if (fs.existsSync(fontBdPath)) {
      const bdBuf = fs.readFileSync(fontBdPath);
      doc.addFileToVFS('NRT-Bd.ttf', bdBuf.toString('base64'));
      doc.addFont('NRT-Bd.ttf', 'NRT', 'bold');
    }
    doc.setFont('NRT');
  } catch (err) {
    logger.warn('[ReportService] Error loading custom NRT font into jsPDF:', err);
  }

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 36, 'F');

  // Title in Header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('ASHLEY FURNITURE HOMESTORE - KURDISTAN', 105, 14, { align: 'center' });
  doc.setFontSize(13);
  doc.text('کۆمپانیای سەرەکی ئاشڵی - ڕاپۆرتی فەرمی دەوامی مانگانە', 105, 24, { align: 'center' });

  // Subheader info bar
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(10, 42, 190, 24, 'F');
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.rect(10, 42, 190, 24, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(`ناوی کارمەند: ${stats.employeeName}`, 195, 51, { align: 'right' });
  doc.text(`کۆدی کارمەند: ${stats.employeeId}`, 195, 60, { align: 'right' });

  const kurdishMonth = formatKurdishMonthName(stats.monthStr);
  doc.text(`مانگی دەوام: ${kurdishMonth}`, 15, 51, { align: 'left' });
  const { dateStr, timeStr } = getBaghdadNow();
  doc.text(`کاتی دەرچوواندن: ${dateStr} ${timeStr}`, 15, 60, { align: 'left' });

  // Summary Stat Boxes (4-column grid)
  const boxY = 72;
  const boxW = 44;
  const boxH = 20;

  // Box 1: Work Hours
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.rect(156, boxY, boxW, boxH, 'FD');
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.setFontSize(9);
  doc.text('کۆی کاتژمێری کار', 178, boxY + 7, { align: 'center' });
  doc.setFontSize(11);
  doc.text(stats.totalWorkHoursStr, 178, boxY + 15, { align: 'center' });

  // Box 2: Present Days
  doc.setFillColor(239, 246, 255); // blue-50
  doc.rect(108, boxY, boxW, boxH, 'FD');
  doc.setTextColor(30, 64, 175); // blue-800
  doc.setFontSize(9);
  doc.text('ڕۆژانی ئامادەبوو', 130, boxY + 7, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`${stats.presentDays} ڕۆژ`, 130, boxY + 15, { align: 'center' });

  // Box 3: Overtime
  doc.setFillColor(254, 243, 199); // amber-50
  doc.rect(60, boxY, boxW, boxH, 'FD');
  doc.setTextColor(146, 64, 14); // amber-800
  doc.setFontSize(9);
  doc.text('ئۆڤەرتایم (زیادە)', 82, boxY + 7, { align: 'center' });
  doc.setFontSize(11);
  doc.text(stats.totalOvertimeStr, 82, boxY + 15, { align: 'center' });

  // Box 4: Late minutes
  doc.setFillColor(254, 242, 242); // rose-50
  doc.rect(12, boxY, boxW, boxH, 'FD');
  doc.setTextColor(153, 27, 27); // rose-800
  doc.setFontSize(9);
  doc.text('کۆی دواکەوتن (درەنگ)', 34, boxY + 7, { align: 'center' });
  doc.setFontSize(11);
  doc.text(stats.totalLateStr, 34, boxY + 15, { align: 'center' });

  // Table of Records
  const tableData: any[][] = [];
  for (const r of stats.records) {
    const statusLabel =
      r.status === 'Present' ? 'ئامادە' :
      r.status === 'Absent' ? 'غیاب' :
      r.status === 'Leave' ? 'مۆڵەت' :
      r.status === 'Holiday' ? 'پشوو' : 'ناڕوون';

    let notes = '';
    if (r.overtimeMinutes > 0) notes += `+${r.overtimeMinutes}خ ئەزافی `;
    if (r.lateMinutes > 0) notes += `درەنگ: ${r.lateMinutes}خ `;

    tableData.push([
      notes || '-',
      statusLabel,
      r.durationStr || '-',
      r.checkOut || '--:--',
      r.checkIn || '--:--',
      r.dayName,
      r.date,
    ]);
  }

  autoTable(doc, {
    startY: 98,
    margin: { left: 10, right: 10 },
    head: [['تێبینی', 'دۆخ', 'ماوەی کار', 'دەرچوون', 'هاتن', 'ڕۆژ', 'ڕێکەوت']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', '-', '-', 'هیچ دەوامێک تۆمار نەکراوە']],
    styles: {
      font: 'NRT',
      fontSize: 9,
      halign: 'center',
      cellPadding: 2.5,
    },
    headStyles: {
      font: 'NRT',
      fillColor: [30, 41, 59], // slate-800
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Footer / Signatures
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 20;

  doc.setDrawColor(203, 213, 225);
  doc.line(10, footerY - 5, 200, footerY - 5);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('بەشی سەرچاوە مرۆییەکان و وردبینی دەوام - کۆمپانیای ئاشڵی', 105, footerY, { align: 'center' });
  doc.text('تێبینی: ئەم پسوولەیە بە شێوەی ئۆتۆماتیکی لە سیستەمی دەوامی ئاشڵی دەرکراوە و پێویستی بە مۆر نییە.', 105, footerY + 5, { align: 'center' });

  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}
