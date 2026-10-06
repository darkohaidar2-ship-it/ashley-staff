import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import { getBaghdadNow } from '@/lib/telegram/telegram-service';
import { shapeKurdishForPdf } from '@/lib/attendance/kurdish-shaper';

import { 
  DayPunchRecord, 
  MonthlyAttendanceStats, 
  formatMinutesToKurdish, 
  getPreviousMonthStr, 
  getNextMonthStr, 
  formatKurdishMonthName, 
  getKurdishDayName 
} from './report-helpers';
export * from './report-helpers';
import { getEmployeeShiftConfig, calculateNetWorkedAndOvertime } from '@/lib/attendance/shift-service';

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

  const shiftConfig = getEmployeeShiftConfig(employeeId);
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

      if (inTime && outTime) {
        // 🧮 Pure Net Working Time Rule (Lunch break automatically deducted!)
        const calc = calculateNetWorkedAndOvertime(inTime, outTime, shiftConfig);
        durationMins = calc.netWorkedMinutes;
        lateMins = calc.lateMinutes;
        otMins = calc.overtimeMinutes;

        totalWorkMinutes += durationMins;
        totalLateMinutes += lateMins;
        totalOvertimeMinutes += otMins;
      } else if (inTime && !outTime && d === getBaghdadNow().dateStr) {
        // ⏱️ Real-time calculation for employee currently at work today!
        const curTimeStr = getBaghdadNow().timeStr;
        const calc = calculateNetWorkedAndOvertime(inTime, curTimeStr, shiftConfig);
        durationMins = calc.netWorkedMinutes;
        lateMins = calc.lateMinutes;
        otMins = calc.overtimeMinutes;

        totalWorkMinutes += durationMins;
        totalLateMinutes += lateMins;
        totalOvertimeMinutes += otMins;
        dayStatus = 'Present';
      } else {
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

  // Total expected working days in the month (excluding official holidays)
  const targetWorkingDays = Math.max(1, dayRecords.filter(r => r.status !== 'Holiday').length);
  const targetDayMinutes = (shiftConfig.targetWorkHours || 8) * 60; // 8 * 60 = 480 mins, 7 * 60 = 420 mins
  const targetWorkMinutes = targetWorkingDays * targetDayMinutes;
  const attendancePercent = targetWorkMinutes > 0 
    ? Math.min(100, Math.round(((totalWorkMinutes + totalOvertimeMinutes) / targetWorkMinutes) * 100))
    : 0;

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
    targetWorkingDays,
    attendancePercent,
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
  msg += `• 🟢 ڕۆژانی دەوام: <b>${stats.presentDays}</b> ڕۆژ لە کۆی <b>${stats.targetWorkingDays}</b> ڕۆژی فەرمی\n`;
  msg += `• ⏱️ کۆی کاتژمێری کارکردن: <b>${stats.totalWorkHoursStr}</b>\n`;
  msg += `• 📈 <b>ڕێژەی سەدی ئامادەبوون (Attendance %):</b> <b>${stats.attendancePercent}%</b>\n`;
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
        const dayPct = Math.min(100, Math.round((r.durationMinutes / 540) * 100));
        msg += `📅 <b>${shortDate}</b>: [${inText} | ${outText}] (${r.durationStr} - ${dayPct}%)${extra}\n`;
      }
    }
  } else {
    msg += `<i>تا ئێستا هیچ تۆمارێکی دەوام بۆ ئەم مانگە نییە.</i>\n`;
  }

  msg += `\n✨ <i>ڕاپۆرتی فەرمی PDF بۆ دەوامی ئەم مانگە ئامادەکراوە و لە خوارەوە بۆتان دەنێردرێت:</i>`;
  return msg;
}

// ---------------------------------------------------------------------------
// 3. INLINE KEYBOARD FOR MONTH NAVIGATION & PDF DOWNLOAD
// ---------------------------------------------------------------------------
export function getMonthlyReportInlineKeyboard(monthStr: string, employeeId?: string) {
  const prevMonth = getPreviousMonthStr(monthStr);
  const nextMonth = getNextMonthStr(monthStr);
  const empParam = employeeId || 'emp-02';
  const printUrl = `https://ashley-staff.vercel.app/attendance/report/print?emp=${encodeURIComponent(empParam)}&month=${encodeURIComponent(monthStr)}&auto=1`;

  return {
    inline_keyboard: [
      [
        { text: '◀️ مانگی پێشوو', callback_data: `month:${prevMonth}` },
        { text: `📅 ${monthStr}`, callback_data: `month:${monthStr}` },
        { text: 'مانگی دواتر ▶️', callback_data: `month:${nextMonth}` },
      ],
      [
        { text: '🖨️ بینین و چاپی فەرمی (Print / PDF)', url: printUrl },
      ],
      [
        { text: '📥 داگرتنی فایلی پسوولە (PDF)', callback_data: `pdf:${monthStr}` },
      ],
    ],
  };
}

// ---------------------------------------------------------------------------
// 4. GENERATE ELEGANT OFFICIAL PDF REPORT USING JSPDF, LOGOS & KURDISH SHAPER
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

  // 🌟 1. UPPER LETTERHEAD BANNER (SLATE-950)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 36, 'F');

  // Embed Ashley Official Logo on Top Left
  try {
    const logoPath = path.join(process.cwd(), 'public', 'ashley-logo.png');
    if (fs.existsSync(logoPath)) {
      const imgBase64 = fs.readFileSync(logoPath).toString('base64');
      doc.addImage(`data:image/png;base64,${imgBase64}`, 'PNG', 12, 6, 28, 16);
    }
  } catch (logoErr) {
    logger.warn('[ReportService] Error loading ashley-logo.png into PDF:', logoErr);
  }

  // Right Side: Diwan Group Title (Shaped Kurdish)
  doc.setTextColor(245, 158, 11); // amber-500
  doc.setFontSize(11);
  doc.text(shapeKurdishForPdf('کۆمپانیای گروپی دیوان'), 196, 14, { align: 'right' });
  doc.setTextColor(203, 213, 225); // slate-300
  doc.setFontSize(8.5);
  doc.text(shapeKurdishForPdf('ناسنامەی مۆبیلیات'), 196, 21, { align: 'right' });

  // Center: Official Ashley Report Titles
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text('ASHLEY FURNITURE HOMESTORE', 105, 13, { align: 'center' });
  doc.setFontSize(11);
  doc.text(shapeKurdishForPdf('کۆمپانیای مۆبیلیاتی ئاشڵی — ڕاپۆرتی فەرمی دەوامی مانگانە'), 105, 21, { align: 'center' });
  
  const kurdishMonth = formatKurdishMonthName(stats.monthStr);
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(9);
  doc.text(shapeKurdishForPdf(`مانگی ${kurdishMonth}`), 105, 28, { align: 'center' });

  // 🌟 2. SUBHEADER INFO BAR
  doc.setFillColor(248, 250, 252); // slate-50
  doc.rect(10, 41, 190, 22, 'F');
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.rect(10, 41, 190, 22, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.text(shapeKurdishForPdf(`ناوی کارمەند: ${stats.employeeName}`), 195, 49, { align: 'right' });
  doc.text(shapeKurdishForPdf(`کۆدی کارمەند: ${stats.employeeId}`), 195, 57, { align: 'right' });

  const { dateStr, timeStr } = getBaghdadNow();
  doc.text(shapeKurdishForPdf(`بەرواری دەرچوواندن: ${dateStr}`), 15, 49, { align: 'left' });
  doc.text(shapeKurdishForPdf(`کاتی تۆمار: ${timeStr}`), 15, 57, { align: 'left' });

  doc.setFontSize(9.5);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(shapeKurdishForPdf(`ڕێژەی ئامادەبوون: ${stats.attendancePercent}%`), 105, 57, { align: 'center' });

  // 🌟 3. SUMMARY STAT BOXES (4-COLUMN GRID)
  const boxY = 68;
  const boxW = 44;
  const boxH = 19;

  // Box 1: Work Hours
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.rect(156, boxY, boxW, boxH, 'FD');
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.setFontSize(8.5);
  doc.text(shapeKurdishForPdf(`کۆی کاتژمێر (${stats.attendancePercent}%)`), 178, boxY + 6.5, { align: 'center' });
  doc.setFontSize(10.5);
  doc.text(stats.totalWorkHoursStr, 178, boxY + 14, { align: 'center' });

  // Box 2: Present Days
  doc.setFillColor(239, 246, 255); // blue-50
  doc.rect(108, boxY, boxW, boxH, 'FD');
  doc.setTextColor(30, 64, 175); // blue-800
  doc.setFontSize(8.5);
  doc.text(shapeKurdishForPdf('ڕۆژانی دەوام'), 130, boxY + 6.5, { align: 'center' });
  doc.setFontSize(10.5);
  doc.text(shapeKurdishForPdf(`${stats.presentDays} لە ${stats.targetWorkingDays} ڕۆژ`), 130, boxY + 14, { align: 'center' });

  // Box 3: Overtime
  doc.setFillColor(254, 243, 199); // amber-50
  doc.rect(60, boxY, boxW, boxH, 'FD');
  doc.setTextColor(146, 64, 14); // amber-800
  doc.setFontSize(8.5);
  doc.text(shapeKurdishForPdf('ئۆڤەرتایم (ئیزافە)'), 82, boxY + 6.5, { align: 'center' });
  doc.setFontSize(10.5);
  doc.text(stats.totalOvertimeStr, 82, boxY + 14, { align: 'center' });

  // Box 4: Late minutes
  doc.setFillColor(254, 242, 242); // rose-50
  doc.rect(12, boxY, boxW, boxH, 'FD');
  doc.setTextColor(153, 27, 27); // rose-800
  doc.setFontSize(8.5);
  doc.text(shapeKurdishForPdf('کۆی دواکەوتن'), 34, boxY + 6.5, { align: 'center' });
  doc.setFontSize(10.5);
  doc.text(stats.totalLateStr, 34, boxY + 14, { align: 'center' });

  // 🌟 4. TABLE OF RECORDS (SHAPED KURDISH HEADERS & BODY)
  const tableData: any[][] = [];
  for (const r of stats.records) {
    const statusLabel =
      r.status === 'Present' ? shapeKurdishForPdf('ئامادەبوو') :
      r.status === 'Absent' ? shapeKurdishForPdf('غایب') :
      r.status === 'Leave' ? shapeKurdishForPdf('مۆڵەت') :
      r.status === 'Holiday' ? shapeKurdishForPdf('پشوو') : shapeKurdishForPdf('دەوام نەکراو');

    let notes = '';
    if (r.overtimeMinutes > 0) notes += shapeKurdishForPdf(`+${r.overtimeMinutes}خ ئیزافە `);
    if (r.lateMinutes > 0) notes += shapeKurdishForPdf(`درەنگ: ${r.lateMinutes}خ `);

    tableData.push([
      notes || '-',
      statusLabel,
      r.durationStr || '-',
      r.checkOut || '--:--',
      r.checkIn || '--:--',
      shapeKurdishForPdf(r.dayName),
      r.date,
    ]);
  }

  const tableHeaders = ['تێبینی', 'دۆخ', 'ماوەی کار', 'دەرچوون', 'هاتن', 'ڕۆژ', 'ڕێکەوت'].map(shapeKurdishForPdf);

  autoTable(doc, {
    startY: 92,
    margin: { left: 10, right: 10, bottom: 38 },
    head: [tableHeaders],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', '-', '-', shapeKurdishForPdf('هیچ دەوامێک تۆمار نەکراوە')]],
    styles: {
      font: 'NRT',
      fontSize: 8.5,
      halign: 'center',
      cellPadding: 2,
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

  // 🌟 5. LOWER LETTERHEAD SIGNATURES STRIP (3 OFFICIAL ROLES)
  const pageHeight = doc.internal.pageSize.getHeight();
  const sigY = pageHeight - 32;

  doc.setDrawColor(203, 213, 225);
  doc.line(10, sigY - 3, 200, sigY - 3);

  const sigRoles = [
    { title: 'سەرپەرشتیاری ئایتی', x: 12, w: 58 },
    { title: 'بەڕێوەبەری ژمێریاری و کۆگا', x: 76, w: 58 },
    { title: 'بەڕێوەبەری گشتی', x: 140, w: 58 },
  ];

  sigRoles.forEach(sig => {
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.rect(sig.x, sigY, sig.w, 20, 'FD');

    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(8.5);
    doc.text(shapeKurdishForPdf(sig.title), sig.x + (sig.w / 2), sigY + 5, { align: 'center' });

    doc.setDrawColor(226, 232, 240);
    doc.line(sig.x + 3, sigY + 7, sig.x + sig.w - 3, sigY + 7);

    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFontSize(7.5);
    doc.text(shapeKurdishForPdf('ناو: .......................................'), sig.x + sig.w - 3, sigY + 11.5, { align: 'right' });
    doc.text(shapeKurdishForPdf('واژوو: ....................................'), sig.x + sig.w - 3, sigY + 16.5, { align: 'right' });
  });

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    shapeKurdishForPdf('ئەم پسوولەیە بە شێوەی فەرمی لە سیستەمی سەرەکی کۆمپانیای ئاشڵی (Ashley ERP) دەرکراوە و پەسەندکراوە.'),
    105,
    pageHeight - 6,
    { align: 'center' }
  );

  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}
