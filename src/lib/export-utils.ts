/**
 * Ashley Universal PDF & CSV Export Utility & Pure 24-Hour Military Time Engine
 * Generates pixel-perfect, full-width multi-page PDF documents, 31-page daily breakdowns, and Excel-compatible CSVs with UTF-8 BOM.
 */

export interface ExportTableColumn {
  header: string;
  key: string;
  align?: 'right' | 'center' | 'left';
  width?: string;
}

export interface ExportReportOptions {
  title: string;
  subtitle?: string;
  period?: string;
  columns: ExportTableColumn[];
  data: Record<string, any>[];
  summaryCards?: Array<{ label: string; value: string | number; color?: string }>;
  kpiNotes?: string[];
  orientation?: 'landscape' | 'portrait';
  fileName?: string;
}

export interface DailyReportRow {
  index: number;
  empId: string;
  name: string;
  role: string;
  checkInTime: string;
  checkInOriginalTime?: string;
  checkInNote?: string;
  checkOutTime: string;
  checkOutOriginalTime?: string;
  checkOutNote?: string;
  durationStr: string;
  overtimeStr: string;
  adminNote?: string;
  status: 'present' | 'absent' | 'off' | 'future' | 'leave';
}

export interface MonthDailyReportOptions {
  month: string; // 'yyyy-MM' (e.g. '2026-08')
  daysData: Array<{
    dateStr: string; // '2026-08-01'
    dayNum: number; // 1
    dayName: string; // 'شەممە'
    isFriday: boolean;
    rows: DailyReportRow[];
    summary: {
      totalEmployees: number;
      presentCount: number;
      lateCount: number;
      overtimeCount: number;
      totalOvertimeHours: number;
    };
  }>;
  title?: string;
  subtitle?: string;
}

/**
 * 🌟 Convert any timestamp into clean 24-hour military digital format ("HH:mm")
 * Completely stripped of all words ("پ.ن", "ب.ن", "پێش نیوەڕۆ", "دوای نیوەڕۆ", "شەو", etc.)
 * Example: '08:00:00' -> '08:00', '17:15:00' -> '17:15', '00:00:00' -> '24:00' or '00:00'
 */
export function formatTime24H(timeStr?: string | null): string {
  if (!timeStr || timeStr === '-' || timeStr === '') return '-';
  let timePart = String(timeStr).trim();
  if (timePart.includes('T')) {
    const splitT = timePart.split('T')[1];
    if (splitT) timePart = splitT.split('.')[0] || splitT;
  } else if (timePart.includes(' ')) {
    const parts = timePart.split(' ');
    timePart = parts[parts.length - 1] || timePart;
  }

  // Remove any non-digit and non-colon characters
  timePart = timePart.replace(/[^\d:]/g, '');

  const chunks = timePart.split(':');
  if (chunks.length < 2) return timeStr;

  let hour = parseInt(chunks[0], 10);
  const minute = chunks[1].slice(0, 2).padStart(2, '0');

  if (isNaN(hour)) return timeStr;

  const hourStr = hour.toString().padStart(2, '0');
  return `${hourStr}:${minute}`;
}

// Alias formatTime12H to formatTime24H to ensure 100% pure 24H everywhere
export const formatTime12H = formatTime24H;

/**
 * 🌟 Smart Status Color Determination for 2 Distinct In/Out Colors:
 * - هاتن (Check-In): 🟢 سەوزی زەمروودی (Emerald Green)
 * - چون / ڕۆیشتن (Check-Out): 🔵 شینی پاشایی (Sky / Royal Blue)
 * Stripped of all extra words, pure 24-hour time.
 */
export function getAttendanceTimeBadge(timeStr: string | null | undefined, type: 'in' | 'out'): {
  status: 'in' | 'out';
  colorClass: string;
  cssClass: string;
  badgeStyle: { bg: string; color: string; border: string };
  label: string;
  formattedTime: string;
} {
  if (!timeStr || timeStr === '-' || timeStr === '') {
    return {
      status: type,
      colorClass: 'bg-slate-100 text-slate-500 border-slate-300',
      cssClass: 'badge-empty',
      badgeStyle: { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
      label: '-',
      formattedTime: '-',
    };
  }

  const formattedTime = formatTime24H(timeStr);

  if (type === 'in') {
    // 🟢 هاتن (Check-In): سەوزی زەمروودی (Emerald Green)
    return {
      status: 'in',
      colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      cssClass: 'badge-in-time',
      badgeStyle: { bg: '#ecfdf5', color: '#065f46', border: '#10b981' },
      label: 'هاتن',
      formattedTime,
    };
  } else {
    // 🔵 چون / ڕۆیشتن (Check-Out): شینی پاشایی / ئاسمانی (Sky / Royal Blue)
    return {
      status: 'out',
      colorClass: 'bg-sky-50 text-sky-800 border-sky-300',
      cssClass: 'badge-out-time',
      badgeStyle: { bg: '#f0f9ff', color: '#0369a1', border: '#0284c7' },
      label: 'چون',
      formattedTime,
    };
  }
}

/**
 * Export data as clean UTF-8 CSV with BOM for Microsoft Excel
 */
export function exportToCSV(
  columns: ExportTableColumn[],
  data: Record<string, any>[],
  fileName: string = 'ashley-report'
) {
  const headers = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');
  const rows = data.map(row => {
    return columns
      .map(c => {
        const val = row[c.key] !== undefined && row[c.key] !== null ? String(row[c.key]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${fileName.replace(/\.csv$/, '')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate full-width, multi-page, professional Colorful PDF Report with Print / Save as PDF
 */
export function exportToPDF(options: ExportReportOptions) {
  const {
    title,
    subtitle = 'کۆمپانیای ئاشڵی — Inspire Your Home (ئیلهام بەخشین بە ماڵەکەت)',
    period = '',
    columns,
    data,
    summaryCards = [],
    orientation = 'landscape',
    fileName = 'Ashley_Report',
  } = options;

  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) {
    alert('تکایە ڕێگە بدە بە پەنجەرەی Pop-up بۆ کردنەوەی PDF');
    return;
  }

  const currentDateStr = new Date().toLocaleDateString('ku-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentTimeStr = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const html = `
<!DOCTYPE html>
<html lang="ku" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${fileName}</title>
  <style>
    @page {
      size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
      margin: 8mm 8mm 12mm 8mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Tahoma, 'Noto Kufi Arabic', Arial, sans-serif;
      margin: 0;
      padding: 10px;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
      direction: rtl;
    }
    .report-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    
    /* 🌟 COLORFUL EXECUTIVE HEADER */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e3a8a 100%) !important;
      color: #ffffff !important;
      padding: 12px 16px;
      border-radius: 10px;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
      border: 1px solid #1e3a8a;
    }
    .header-titles h1 {
      margin: 0;
      font-size: 17px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.3px;
    }
    .header-titles h2 {
      margin: 3px 0 0 0;
      font-size: 11px;
      font-weight: 700;
      color: #cbd5e1;
    }
    .header-meta {
      text-align: left;
      font-size: 10px;
      font-weight: bold;
      color: #f1f5f9;
    }
    .header-meta .badge {
      display: inline-block;
      background: #3b82f6 !important;
      color: #ffffff !important;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 900;
      margin-bottom: 3px;
      border: 1px solid rgba(255,255,255,0.4);
    }

    /* 📊 VIBRANT SUMMARY KPI CARDS */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(${Math.max(1, Math.min(summaryCards.length, 5))}, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .summary-card {
      background: #f8fafc !important;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .summary-card:nth-child(1) {
      border-top: 4px solid #2563eb !important;
      background: #eff6ff !important;
    }
    .summary-card:nth-child(2) {
      border-top: 4px solid #d97706 !important;
      background: #fffbeb !important;
    }
    .summary-card:nth-child(3) {
      border-top: 4px solid #059669 !important;
      background: #ecfdf5 !important;
    }
    .summary-card:nth-child(4) {
      border-top: 4px solid #7c3aed !important;
      background: #f5f3ff !important;
    }
    .summary-card:nth-child(5) {
      border-top: 4px solid #e11d48 !important;
      background: #fff1f2 !important;
    }
    .summary-card .label {
      font-size: 10px;
      font-weight: 800;
      color: #334155;
      display: block;
      margin-bottom: 3px;
    }
    .summary-card .value {
      font-size: 14px;
      font-weight: 900;
      color: #0f172a;
      font-family: Consolas, monospace;
    }

    /* 📋 COLORFUL FULL-WIDTH TABLE */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 6px;
      page-break-inside: auto;
      border: 1.5px solid #64748b !important;
      border-radius: 6px;
      overflow: hidden;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    th {
      background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) !important;
      color: #ffffff !important;
      font-weight: 900;
      font-size: 10.5px;
      padding: 7px 8px;
      border: 1px solid #475569;
      text-align: right;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
    }
    tbody tr:nth-child(even) {
      background-color: #f8fafc !important;
    }
    tbody tr:nth-child(odd) {
      background-color: #ffffff !important;
    }

    /* 🌟 TWO DISTINCT 24-HOUR COLORS (GREEN FOR IN, BLUE FOR OUT) */
    .badge-in-time {
      background: #ecfdf5 !important;
      color: #065f46 !important;
      border: 1.5px solid #10b981 !important;
      padding: 2.5px 8px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
      font-family: Consolas, monospace;
    }
    .badge-out-time {
      background: #f0f9ff !important;
      color: #0369a1 !important;
      border: 1.5px solid #0284c7 !important;
      padding: 2.5px 8px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
      font-family: Consolas, monospace;
    }
    .badge-edited {
      background: #eff6ff !important;
      color: #1e40af !important;
      border: 1.5px solid #60a5fa !important;
      padding: 2.5px 8px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
    }
    .badge-date {
      background: #f8fafc !important;
      color: #0f172a !important;
      border: 1px solid #94a3b8 !important;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 800;
      font-family: Consolas, monospace;
      display: inline-block;
      white-space: nowrap;
    }
    .badge-ot {
      background: #fffbeb !important;
      color: #b45309 !important;
      border: 1.5px solid #f59e0b !important;
      padding: 2.5px 8px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
    }
    .badge-money {
      background: #ecfdf5 !important;
      color: #065f46 !important;
      border: 1.5px solid #10b981 !important;
      padding: 2.5px 8px;
      border-radius: 5px;
      font-weight: 900;
      font-family: Consolas, monospace;
      display: inline-block;
      white-space: nowrap;
    }

    /* Footer & Signatures */
    .report-footer {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 12px;
      border-top: 2px dashed #94a3b8;
      font-size: 10px;
      color: #475569;
      page-break-inside: avoid;
    }
    .signature-box {
      text-align: center;
      width: 190px;
      border-top: 1.5px solid #334155;
      padding-top: 6px;
      font-weight: bold;
      color: #0f172a;
    }

    /* Print Controls */
    .print-controls-bar {
      position: fixed;
      bottom: 15px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #ffffff;
      padding: 8px 18px;
      border-radius: 30px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 9999;
    }
    .print-btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 6px 16px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
    }
    .print-btn:hover {
      background: #1d4ed8;
    }

    @media print {
      body {
        padding: 0;
      }
      .no-print, .print-controls-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="print-controls-bar no-print">
    <span>🖨️ ئامادەیە بۆ پرێنت / داگرتن وەک PDF</span>
    <button class="print-btn" onclick="window.print()">پرێنت بکە (Print)</button>
  </div>

  <div class="report-container">
    <!-- Header -->
    <div class="report-header">
      <div class="header-titles">
        <h1>${title}</h1>
        <h2>${subtitle}</h2>
      </div>
      <div class="header-meta">
        ${period ? `<div class="badge">ماوە: ${period}</div><br>` : ''}
        <span>بەرواری دەرچوون: ${currentDateStr} (${currentTimeStr})</span>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    ${
      summaryCards.length > 0
        ? `
    <div class="summary-grid">
      ${summaryCards
        .map(
          c => `
      <div class="summary-card">
        <span class="label">${c.label}</span>
        <span class="value" style="${c.color ? `color:${c.color};` : ''}">${c.value}</span>
      </div>
      `
        )
        .join('')}
    </div>
    `
        : ''
    }

    <!-- Main Data Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">#</th>
          ${columns
            .map(
              col => `
            <th style="text-align: ${col.align || 'right'}; ${col.width ? `width: ${col.width};` : ''}">
              ${col.header}
            </th>
          `
            )
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${data
          .map(
            (row, index) => `
          <tr>
            <td style="text-align: center; color: #64748b; font-family: monospace;">${index + 1}</td>
            ${columns
              .map(col => {
                const val = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-';
                
                let formattedCell = val;
                const lowerKey = col.key.toLowerCase();
                const lowerVal = val.toLowerCase();

                if (lowerVal.includes('گۆڕاو') || lowerVal.includes('دەستکاریکراو') || lowerVal.includes('edited') || lowerVal.includes('modified') || lowerKey.includes('edit')) {
                  formattedCell = `<span class="badge-edited">✏️ ${formatTime24H(val)}</span>`;
                } else if (lowerKey.includes('in') || lowerKey.includes('هاتن') || lowerVal.includes('📥')) {
                  const badge = getAttendanceTimeBadge(val, 'in');
                  formattedCell = `<span class="${badge.cssClass}">📥 ${badge.formattedTime}</span>`;
                } else if (lowerKey.includes('out') || lowerKey.includes('ڕۆشتن') || lowerKey.includes('دەرچوون') || lowerKey.includes('چون') || lowerVal.includes('📤')) {
                  const badge = getAttendanceTimeBadge(val, 'out');
                  formattedCell = `<span class="${badge.cssClass}">📤 ${badge.formattedTime}</span>`;
                } else if (lowerKey.includes('date') || lowerKey.includes('بەروار') || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
                  formattedCell = `<span class="badge-date">📅 ${val}</span>`;
                } else if (lowerKey.includes('amount') || lowerKey.includes('cost') || lowerKey.includes('pay') || lowerVal.includes('iqd')) {
                  formattedCell = `<span class="badge-money">${val}</span>`;
                } else if (lowerKey.includes('hour') || lowerKey.includes('overtime') || lowerVal.includes('کاتژمێر')) {
                  formattedCell = `<span class="badge-ot">${val}</span>`;
                }

                return `
                  <td style="text-align: ${col.align || 'right'};">
                    ${formattedCell}
                  </td>
                `;
              })
              .join('')}
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <!-- Footer & Signatures -->
    <div class="report-footer">
      <div>
        <p style="margin: 0; font-weight: bold;">سیستەمی بەڕێوەبردنی سەرچاوەکانی مرۆیی ئاشڵی (Ashley ERP 2026)</p>
        <p style="margin: 2px 0 0 0; color: #64748b;">تێبینی: ئەم ڕاپۆرتە فەرمییە و لەسەر بنەمای ئامادەبوونی ئەلیکترۆنی دەرکراوە.</p>
      </div>

      <div style="display: flex; gap: 30px;">
        <div class="signature-box">
          واژووی سەرپەرشتیار
        </div>
        <div class="signature-box">
          واژووی بەڕێوەبەری کارگێڕی
        </div>
      </div>
    </div>

  </div>

</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * 🌟 31-PAGE MULTI-PAGE MONTHLY DAILY PDF GENERATOR
 * Generates a full month PDF where EACH DAY is on its OWN SEPARATE PAGE (page-break-after: always)
 */
export function exportMonthlyMultiPageDailyPDF(options: MonthDailyReportOptions) {
  const {
    month,
    daysData,
    title = 'ڕاپۆرتی ئامادەبوونی ڕۆژانەی مانگانەی ئاشڵی (Monthly 31-Day Attendance Log)',
    subtitle = 'کۆمپانیای ئاشڵی — Inspire Your Home (ئیلهام بەخشین بە ماڵەکەت)',
  } = options;

  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) {
    alert('تکایە ڕێگە بدە بە پەنجەرەی Pop-up بۆ کردنەوەی PDF');
    return;
  }

  const currentDateStr = new Date().toLocaleDateString('ku-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const currentTimeStr = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const pagesHtml = daysData.map((day, dayIndex) => {
    const isLast = dayIndex === daysData.length - 1;

    return `
    <div class="daily-page-container ${isLast ? 'last-page' : ''}">
      <!-- Page Header -->
      <div class="report-header">
        <div class="header-titles">
          <h1>${title}</h1>
          <h2>${subtitle}</h2>
        </div>
        <div class="header-meta">
          <div class="badge">📅 ${day.dayName} (${day.dateStr}) — لاپەڕەی ${day.dayNum} لە ${daysData.length}</div>
          <br>
          <span>دەرچوونی ڕاپۆرت: ${currentDateStr} (${currentTimeStr})</span>
        </div>
      </div>

      <!-- Daily Summary KPI Cards -->
      <div class="summary-grid">
        <div class="summary-card">
          <span class="label">کۆی کارمەندان</span>
          <span class="value" style="color: #2563eb;">${day.summary.totalEmployees} کەس</span>
        </div>
        <div class="summary-card">
          <span class="label">ئامادەبووان (Present)</span>
          <span class="value" style="color: #059669;">${day.summary.presentCount} کەس</span>
        </div>
        <div class="summary-card">
          <span class="label">دواکەوتوو (Late)</span>
          <span class="value" style="color: #e11d48;">${day.summary.lateCount} کەس</span>
        </div>
        <div class="summary-card">
          <span class="label">خاوەن ئیزافە (Overtime)</span>
          <span class="value" style="color: #7c3aed;">${day.summary.overtimeCount} کەس (+${day.summary.totalOvertimeHours}ک)</span>
        </div>
      </div>

      <!-- Day Attendance Table -->
      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th style="width: 140px;">ناوی کارمەند</th>
            <th style="width: 90px;">پۆست / ئەرک</th>
            <th style="width: 75px; text-align: center;">📥 هاتن</th>
            <th style="width: 130px;">تێبینی هاتنی کارمەند</th>
            <th style="width: 75px; text-align: center;">📤 ڕۆیشتن</th>
            <th style="width: 130px;">تێبینی ڕۆیشتن / ئیزافە</th>
            <th style="width: 80px; text-align: center;">⏱️ ماوەی دەوام</th>
            <th style="width: 75px; text-align: center;">⚡ ئیزافە</th>
            <th>🛡️ تێبینی ئەدمین</th>
          </tr>
        </thead>
        <tbody>
          ${
            day.rows.length > 0
              ? day.rows
                  .map(
                    r => `
            <tr>
              <td style="text-align: center; color: #64748b; font-family: monospace;">${r.index}</td>
              <td style="font-weight: 900; color: #0f172a;">${r.name}</td>
              <td style="color: #475569;">${r.role}</td>
              <td style="text-align: center;">
                ${
                  r.checkInTime && r.checkInTime !== '-'
                    ? `<span class="badge-in-time">📥 ${r.checkInTime}</span>`
                    : '<span style="color: #94a3b8;">-</span>'
                }
              </td>
              <td style="color: #1e3a8a; font-size: 9.5px;">${r.checkInNote || '-'}</td>
              <td style="text-align: center;">
                ${
                  r.checkOutTime && r.checkOutTime !== '-'
                    ? `<span class="badge-out-time">📤 ${r.checkOutTime}</span>`
                    : '<span style="color: #94a3b8;">-</span>'
                }
              </td>
              <td style="color: #0369a1; font-size: 9.5px;">${r.checkOutNote || '-'}</td>
              <td style="text-align: center; font-family: monospace; font-weight: bold;">${r.durationStr || '-'}</td>
              <td style="text-align: center; font-family: monospace; font-weight: 900; color: #6b21a8;">${r.overtimeStr || '-'}</td>
              <td style="color: #92400e; font-size: 9.5px; font-weight: bold;">${r.adminNote || '-'}</td>
            </tr>
          `
                  )
                  .join('')
              : `
            <tr>
              <td colspan="10" style="text-align: center; padding: 20px; color: #94a3b8; font-weight: bold;">
                ${day.isFriday ? '🌴 ڕۆژی هەینی — پشووی فەرمیی هەفتانە' : 'هیچ تۆمارێک بۆ ئەم ڕۆژە نەدۆزرایەوە'}
              </td>
            </tr>
          `
          }
        </tbody>
      </table>

      <!-- Page Footer & Signatures -->
      <div class="report-footer">
        <div>
          <p style="margin: 0; font-weight: bold;">کۆمپانیای ئاشڵی (Ashley ERP 2026) — مانگی ${month} (ڕۆژی ${day.dayNum})</p>
          <p style="margin: 2px 0 0 0; color: #64748b;">بەڵگەنامەی فەرمیی دەوامی کارمەندان — کۆپی ئەلیکترۆنی.</p>
        </div>

        <div style="display: flex; gap: 30px;">
          <div class="signature-box">
            واژووی سەرپەرشتیار
          </div>
          <div class="signature-box">
            واژووی بەڕێوەبەری کارگێڕی
          </div>
        </div>
      </div>
    </div>
    `;
  }).join('\n');

  const html = `
<!DOCTYPE html>
<html lang="ku" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>ڕاپۆرتی ۳۱ لاپەڕەیی مانگی ${month} - Ashley ERP</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 6mm 6mm 8mm 6mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', Tahoma, 'Noto Kufi Arabic', Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff;
      font-size: 10px;
      line-height: 1.3;
      direction: rtl;
    }
    
    .daily-page-container {
      width: 100%;
      height: 98vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always !important;
      page-break-inside: avoid !important;
      padding: 6px;
      box-sizing: border-box;
    }
    .daily-page-container.last-page {
      page-break-after: auto !important;
    }

    /* 🌟 COLORFUL EXECUTIVE HEADER */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e3a8a 100%) !important;
      color: #ffffff !important;
      padding: 8px 14px;
      border-radius: 8px;
      margin-bottom: 8px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
      border: 1px solid #1e3a8a;
    }
    .header-titles h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 900;
      color: #ffffff;
    }
    .header-titles h2 {
      margin: 2px 0 0 0;
      font-size: 10px;
      font-weight: 700;
      color: #cbd5e1;
    }
    .header-meta {
      text-align: left;
      font-size: 9.5px;
      font-weight: bold;
      color: #f1f5f9;
    }
    .header-meta .badge {
      display: inline-block;
      background: #2563eb !important;
      color: #ffffff !important;
      padding: 3px 8px;
      border-radius: 5px;
      font-size: 9.5px;
      font-weight: 900;
      margin-bottom: 2px;
      border: 1px solid rgba(255,255,255,0.4);
    }

    /* 📊 VIBRANT SUMMARY KPI CARDS */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }
    .summary-card {
      background: #f8fafc !important;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      text-align: center;
    }
    .summary-card:nth-child(1) { border-top: 3.5px solid #2563eb !important; background: #eff6ff !important; }
    .summary-card:nth-child(2) { border-top: 3.5px solid #059669 !important; background: #ecfdf5 !important; }
    .summary-card:nth-child(3) { border-top: 3.5px solid #e11d48 !important; background: #fff1f2 !important; }
    .summary-card:nth-child(4) { border-top: 3.5px solid #7c3aed !important; background: #f5f3ff !important; }
    
    .summary-card .label {
      font-size: 9px;
      font-weight: 800;
      color: #334155;
      display: block;
      margin-bottom: 2px;
    }
    .summary-card .value {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      font-family: Consolas, monospace;
    }

    /* 📋 COLORFUL FULL-WIDTH TABLE */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 4px;
      border: 1.5px solid #64748b !important;
      border-radius: 5px;
      overflow: hidden;
      flex-grow: 1;
    }
    th {
      background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) !important;
      color: #ffffff !important;
      font-weight: 900;
      font-size: 9.5px;
      padding: 6px 6px;
      border: 1px solid #475569;
      text-align: right;
    }
    td {
      padding: 4.5px 6px;
      border: 1px solid #cbd5e1;
      font-size: 9.5px;
      font-weight: 600;
      color: #0f172a;
    }
    tbody tr:nth-child(even) {
      background-color: #f8fafc !important;
    }
    tbody tr:nth-child(odd) {
      background-color: #ffffff !important;
    }

    /* 🌟 TWO DISTINCT 24-HOUR COLORS (GREEN FOR IN, BLUE FOR OUT) */
    .badge-in-time {
      background: #ecfdf5 !important;
      color: #065f46 !important;
      border: 1px solid #10b981 !important;
      padding: 1.5px 6px;
      border-radius: 4px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
      font-family: Consolas, monospace;
    }
    .badge-out-time {
      background: #f0f9ff !important;
      color: #0369a1 !important;
      border: 1px solid #0284c7 !important;
      padding: 1.5px 6px;
      border-radius: 4px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
      font-family: Consolas, monospace;
    }

    /* Footer & Signatures */
    .report-footer {
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 8px;
      border-top: 1.5px dashed #94a3b8;
      font-size: 9px;
      color: #475569;
    }
    .signature-box {
      text-align: center;
      width: 170px;
      border-top: 1.5px solid #334155;
      padding-top: 4px;
      font-weight: bold;
      color: #0f172a;
    }

    /* Print Controls */
    .print-controls-bar {
      position: fixed;
      bottom: 15px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #ffffff;
      padding: 8px 18px;
      border-radius: 30px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 9999;
    }
    .print-btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 6px 16px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
    }
    .print-btn:hover {
      background: #1d4ed8;
    }

    @media print {
      body {
        padding: 0;
      }
      .no-print, .print-controls-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="print-controls-bar no-print">
    <span>🖨️ ئامادەیە بۆ پرێنتی ${daysData.length} لاپەڕەی مانگی ${month} (هەر ڕۆژەی لاپەڕەیەک)</span>
    <button class="print-btn" onclick="window.print()">پرێنت بکە (Print All Pages)</button>
  </div>

  ${pagesHtml}

</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * 🌟 OFFICIAL ASHLEY LETTERHEAD PDF EXPORT
 * Complete formal company report with Ashley logo, executive KPI cards, 
 * attendance & financials matrix, and Darko Haydar's approval stamp/signature.
 */
export interface AshleyOfficialReportRow {
  index?: number;
  empId: string;
  name: string;
  role: string;
  presentDays: number;
  totalHours: number;
  lateCount: number;
  absentCount: number;
  leaveCount: number;
  overtimeHours?: number;
  overtimeAmount?: number;
  expensesAmount?: number;
  rate?: number;
}

export interface AshleyOfficialReportOptions {
  month: string;
  issueDate?: string;
  rows: AshleyOfficialReportRow[];
  settings?: {
    reportLogo?: string | null;
    diwanLogo?: string | null;
    ashleyLogo?: string | null;
    appLogo?: string | null;
    motherCompanyName?: string;
    motherCompanySubtitle?: string;
    brandName?: string;
    brandSubtitle?: string;
    agencyTitle?: string;
    brandSlogan?: string;
    letterheadDocumentTitle?: string;
    letterheadDocumentSubtitle?: string;
    letterheadPrimaryColor?: string;
    letterheadAccentColor?: string;
    letterheadTitleColor?: string;
  };
  kpis?: {
    totalStaff: number;
    totalWorkHours: number;
    totalLateCount: number;
    totalOvertimeHours?: number;
    totalOvertimeCost?: number;
    totalExpensesCost?: number;
    avgRate?: number;
  };
}

export function exportAshleyOfficialLetterheadPDF(options: AshleyOfficialReportOptions) {
  const {
    month,
    issueDate = new Date().toISOString().split('T')[0],
    rows = [],
    settings,
    kpis = {
      totalStaff: rows.length,
      totalWorkHours: rows.reduce((s, r) => s + (r.totalHours || 0), 0),
      totalLateCount: rows.reduce((s, r) => s + (r.lateCount || 0), 0),
      totalOvertimeHours: rows.reduce((s, r) => s + (r.overtimeHours || 0), 0),
      totalOvertimeCost: rows.reduce((s, r) => s + (r.overtimeAmount || 0), 0),
      totalExpensesCost: rows.reduce((s, r) => s + (r.expensesAmount || 0), 0),
      avgRate: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + (r.rate || 100), 0) / rows.length) : 100,
    }
  } = options;

  const motherCompany = settings?.motherCompanyName || 'کۆمپانیای گروپی دیوان';
  const motherCompanySubtitle = settings?.motherCompanySubtitle || 'ناسنامەی مۆبیلیات';
  const brandName = settings?.brandName || 'کۆمپانیای مۆبیلیاتی ئاشڵی';
  const brandSubtitle = settings?.brandSubtitle || 'Official Document';
  const agencyTitle = settings?.agencyTitle || 'بریکاری سەرەکی مۆبیلیاتی ئاشڵین لە هەموو عێراق';
  const brandSlogan = settings?.brandSlogan || 'Inspire Your Home (ئیلهام بەخشین بە ماڵەکەت)';
  const diwanLogo = settings?.diwanLogo || '/diwan-logo.svg';
  const ashleyLogo = settings?.reportLogo || settings?.ashleyLogo || settings?.appLogo || '/ashley-logo.png';
  const docTitle = settings?.letterheadDocumentTitle || 'خشتەی تۆماری ئامادەبوونی فەرمی';
  const docSubtitle = settings?.letterheadDocumentSubtitle || agencyTitle;
  const primaryColor = settings?.letterheadPrimaryColor || '#0f172a';
  const accentColor = settings?.letterheadAccentColor || '#d97706';
  const titleColor = settings?.letterheadTitleColor || primaryColor;

  const printWindow = window.open('', '_blank', 'width=1300,height=900');
  if (!printWindow) {
    alert('تکایە ڕێگە بدە بە کردنەوەی پەنجەرەی نوێ (Pop-up) بۆ کردنەوەی ڕاپۆرتی فەرمی');
    return;
  }

  const rowsHtml = rows.map((r, idx) => `
    <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fcfcfd'}; page-break-inside: avoid;">
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center; font-family: monospace; font-weight: 700; color: #64748b;">${idx + 1}</td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; font-weight: 800; text-align: right; color: #0f172a; white-space: nowrap;">
        ${r.name}
        <span style="display: block; font-size: 8.5px; font-family: monospace; color: #64748b; font-weight: 500;">ID: ${r.empId}</span>
      </td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; font-weight: 700; color: #334155; text-align: right;">${r.role || 'کارمەند'}</td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center;">
        <span style="display: inline-block; background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 6px; padding: 2px 6px; font-weight: 800; font-family: monospace; font-size: 9px;">${r.presentDays} ڕۆژ</span>
      </td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center;">
        <span style="display: inline-block; background: rgba(0, 122, 255, 0.10); color: #007AFF; border: 1px solid rgba(0, 122, 255, 0.2); border-radius: 6px; padding: 2px 6px; font-weight: 800; font-family: monospace; font-size: 9px;">${r.totalHours}h</span>
      </td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center;">
        <span style="display: inline-block; ${r.lateCount > 0 ? 'background: rgba(245, 158, 11, 0.15); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.3);' : 'color: #94a3b8;'} border-radius: 6px; padding: 2px 6px; font-weight: 800; font-family: monospace; font-size: 9px;">
          ${r.lateCount > 0 ? `⚠️ ${r.lateCount} جار` : '٠'}
        </span>
      </td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center;">
        <span style="display: inline-block; ${r.absentCount > 0 ? 'background: rgba(239, 68, 68, 0.12); color: #b91c1c; border: 1px solid rgba(239, 68, 68, 0.25);' : 'color: #94a3b8;'} border-radius: 6px; padding: 2px 6px; font-weight: 800; font-family: monospace; font-size: 9px;">
          ${r.absentCount > 0 ? `${r.absentCount}` : '-'}
        </span>
      </td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center;">
        <span style="display: inline-block; ${r.overtimeHours ? 'background: rgba(124, 58, 237, 0.12); color: #6d28d9; border: 1px solid rgba(124, 58, 237, 0.25);' : 'color: #94a3b8;'} border-radius: 6px; padding: 2px 6px; font-weight: 800; font-family: monospace; font-size: 9px;">
          ${r.overtimeHours ? `+${r.overtimeHours}h` : '-'}
        </span>
      </td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center; font-weight: 800; font-family: monospace; color: #047857;">
        ${r.overtimeAmount ? `${Number(r.overtimeAmount).toLocaleString()} IQD` : '-'}
      </td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center; font-weight: 800; font-family: monospace; color: #b91c1c;">
        ${r.expensesAmount ? `${Number(r.expensesAmount).toLocaleString()} IQD` : '-'}
      </td>
      <td style="border: 1px solid #e2e8f0; padding: 6px 8px; text-align: center;">
        <span style="display: inline-block; background: #f1f5f9; color: #0f172a; border-radius: 6px; padding: 2px 6px; font-weight: 800; font-family: monospace; font-size: 9px;">
          %${r.rate !== undefined ? r.rate : 100}
        </span>
      </td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="ku" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>ڕاپۆرتی فەرمی مانگانەی کۆمپانیای ئاشڵی - ${month}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap');
    
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Vazirmatn", system-ui, sans-serif;
      margin: 0;
      padding: 12px;
      color: #1c1c1e;
      background: #ffffff;
      direction: rtl;
      -webkit-font-smoothing: antialiased;
    }

    .report-container {
      width: 100%;
      max-width: 1150px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 18px 22px;
      background: #ffffff;
    }

    .letterhead {
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 14px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .meta-box {
      font-size: 10px;
      font-family: Consolas, monospace;
      color: #475569;
      line-height: 1.6;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }

    .center-branding {
      text-align: center;
    }

    .center-branding img {
      height: 52px;
      margin-bottom: 4px;
    }

    .center-branding h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.2px;
    }

    .center-branding h2 {
      margin: 2px 0 0 0;
      font-size: 11.5px;
      font-weight: 700;
      color: #64748b;
    }

    .doc-badge {
      display: inline-block;
      margin-top: 6px;
      background: #007AFF;
      color: #ffffff;
      padding: 3px 16px;
      font-size: 10.5px;
      font-weight: 800;
      border-radius: 9999px;
      letter-spacing: 0.3px;
    }

    /* KPI STRIP */
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }

    .kpi-card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 8px 10px;
      text-align: center;
      background: #f8fafc;
    }

    .kpi-card .label {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748b;
      display: block;
      margin-bottom: 3px;
    }

    .kpi-card .val {
      font-size: 14px;
      font-weight: 900;
      font-family: Consolas, monospace;
      color: #0f172a;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 9.5px;
      margin-top: 8px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }

    thead {
      display: table-header-group;
    }

    th {
      background: #f1f5f9;
      color: #1e293b;
      padding: 7px 8px;
      border: 1px solid #e2e8f0;
      text-align: center;
      font-weight: 800;
      font-size: 9.5px;
    }

    tr {
      page-break-inside: avoid;
    }

    /* SIGNATURE BLOCK */
    .signatures-block {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-around;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .sig-col {
      width: 220px;
      background: #f8fafc;
      padding: 12px 16px;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
    }

    .sig-col .title {
      font-size: 10.5px;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 6px;
    }

    .sig-col .line {
      margin-top: 30px;
      border-bottom: 1.5px dashed #cbd5e1;
      width: 130px;
      margin-left: auto;
      margin-right: auto;
    }

    /* OFFICIAL ROUND SEAL */
    .seal-circle {
      margin: 8px auto 0 auto;
      width: 90px;
      height: 90px;
      border: 2.5px dashed #007AFF;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #007AFF;
      font-weight: 800;
      font-size: 8.5px;
      line-height: 1.2;
      background: rgba(0, 122, 255, 0.05);
      transform: rotate(-4deg);
    }

    .print-bar {
      position: fixed;
      top: 15px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(242, 242, 247, 0.90);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      color: #1c1c1e;
      padding: 8px 20px;
      border-radius: 9999px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.12);
      border: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      gap: 14px;
      z-index: 99999;
      font-size: 12px;
      font-weight: 700;
    }

    .print-btn {
      background: #007AFF;
      color: white;
      border: none;
      padding: 6px 20px;
      border-radius: 9999px;
      font-weight: 800;
      font-size: 11.5px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
    }

    @media print {
      body { padding: 0; background: #ffffff !important; }
      .no-print { display: none !important; }
      .report-container { border: none; padding: 0; }
      @page {
        size: A4 landscape;
        margin: 8mm;
      }
    }
  </style>
</head>
<body>

  <div class="print-bar no-print">
    <span>🖨️ ڕاپۆرتی فەرمی مانگانە ئامادەیە</span>
    <button class="print-btn" onclick="window.print()">دەستبەجێ پرێنت بکە (Print / PDF)</button>
  </div>

    <!-- Diwan Group & Ashley Official Dual Letterhead Header -->
    <div class="letterhead" style="border-bottom: 2.5px solid ${primaryColor}; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
      
      <!-- Right: Diwan Group Logo, Mother Company & Subtitle -->
      <div style="display: flex; align-items: center; gap: 12px; flex: 1; justify-content: flex-start;">
        <img src="${diwanLogo}" alt="Diwan Group Logo" style="height: 54px; max-width: 140px; object-fit: contain;" onerror="this.style.display='none'" />
        <div style="text-align: right;">
          <div style="font-size: 13.5px; font-weight: 900; color: ${primaryColor}; line-height: 1.2;">${motherCompany}</div>
          <div style="font-size: 9.5px; font-weight: 800; color: ${accentColor}; margin-top: 1px;">${motherCompanySubtitle}</div>
        </div>
      </div>

      <!-- Center: Subject Document Title, Subtitle & Badge -->
      <div class="center-branding" style="flex: 1.6; text-align: center; padding: 0 8px;">
        <h1 style="font-size: 14.5px; font-weight: 900; color: ${titleColor}; margin: 0; line-height: 1.3;">
          ${docTitle}
        </h1>
        <h2 style="font-size: 11px; font-weight: 800; color: ${accentColor}; margin: 3px 0 0 0;">
          ${docSubtitle}
        </h2>
        <div class="doc-badge" style="margin-top: 6px; display: inline-block; background: ${primaryColor}; color: #ffffff;">
          ڕاپۆرتی مانگانەی گشتی ئامادەبوون، دەوام و دارایی — مانگی ${month}
        </div>
      </div>

      <!-- Left: Ashley Furniture Name, Subtitle, Code & Logo -->
      <div style="display: flex; align-items: center; gap: 12px; flex: 1; justify-content: flex-end;">
        <div class="meta-box" style="text-align: left; padding: 6px 10px; font-size: 9px; line-height: 1.5; margin: 0; border: 1px solid #e2e8f0;">
          <div style="font-size: 10px; font-weight: 900; color: ${primaryColor};">${brandName}</div>
          <div style="font-size: 8.5px; font-weight: 700; color: ${accentColor}; margin-bottom: 2px;">${brandSubtitle || brandSlogan}</div>
          <div><strong>کۆدی دەرچوون:</strong> ASH-DGP-${month}</div>
          <div><strong>بەرواری دەرچوون:</strong> ${issueDate}</div>
        </div>
        <img src="${ashleyLogo}" alt="Ashley Logo" style="height: 48px; max-width: 130px; object-fit: contain;" onerror="this.style.display='none'" />
      </div>

    </div>

    <!-- Executive KPI Summary Cards -->
    <div class="kpi-strip">
      <div class="kpi-card" style="border-top: 3px solid #007AFF;">
        <span class="label">کۆی کارمەندانی چالاک</span>
        <span class="val" style="color: #007AFF;">${kpis.totalStaff} کەس</span>
      </div>
      <div class="kpi-card" style="border-top: 3px solid #10b981;">
        <span class="label">کۆی کاتژمێرەکانی ئیشکردن</span>
        <span class="val" style="color: #047857;">${kpis.totalWorkHours.toLocaleString()}h</span>
      </div>
      <div class="kpi-card" style="border-top: 3px solid #f59e0b;">
        <span class="label">حاڵەتی درەنگکەوتن</span>
        <span class="val" style="color: #b45309;">${kpis.totalLateCount} جار</span>
      </div>
      <div class="kpi-card" style="border-top: 3px solid #8b5cf6;">
        <span class="label">کۆی کاتی زیادە (ئیزافە)</span>
        <span class="val" style="color: #6d28d9;">+${kpis.totalOvertimeHours || 0}h</span>
      </div>
      <div class="kpi-card" style="border-top: 3px solid #10b981;">
        <span class="label">شایستەی پارەی ئیزافە</span>
        <span class="val" style="color: #047857;">${(kpis.totalOvertimeCost || 0).toLocaleString()} IQD</span>
      </div>
    </div>

    <!-- Official Records Table -->
    <table>
      <thead>
        <tr>
          <th style="width: 32px;">#</th>
          <th>ناوی کارمەند</th>
          <th>پۆست / ئەرک</th>
          <th>ئامادەبوو</th>
          <th>کۆی کاژێر</th>
          <th>درەنگ</th>
          <th>غیاب</th>
          <th>کاتی زیادە</th>
          <th>پارەی ئیزافە</th>
          <th>مەسروفات / سلفە</th>
          <th>ڕێژە ٪</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Official Executive Signatures Block -->
    <div class="signatures-block">
      <div class="sig-col">
        <div class="title">ئامادەکاری سەرچاوە مرۆییەکان (HR):</div>
        <div style="font-size: 9.5px; color: #64748b;">تۆماری ئەلیکترۆنی و وردبینی دەوام</div>
        <div class="line"></div>
      </div>

      <div class="sig-col">
        <div class="title">بەڕێوەبەری ژمێریاری و وردبینی دارایی:</div>
        <div style="font-size: 9.5px; color: #64748b;">پەسەندکردنی شایستە و خەرجییەکان</div>
        <div class="line"></div>
      </div>

      <div class="sig-col">
        <div class="title" style="color: #007AFF;">پەسەندکردنی بەڕێوەبەری گشتی:</div>
        <div style="font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 2px;">دارکۆ حەیدەر عەزیز</div>
        <div style="font-size: 9px; color: #64748b; font-weight: bold;">General Manager • Ashley Industrial Co.</div>
        
        <!-- Official Diwan Group & Ashley Company Stamp -->
        <div class="seal-circle">
          <div style="font-size: 6px; color: #007AFF;">★ ★ ★</div>
          <div style="font-size: 7.5px; font-weight: 900; color: #0f172a;">گروپی دیوان • ئاشڵی</div>
          <div style="font-size: 6.5px; font-weight: 800; color: #047857; background: #ecfdf5; padding: 1px 4px; border: 0.5px solid #10b981; margin: 1px 0; border-radius: 3px;">پەسەندکراوە</div>
          <div style="font-size: 5.5px; font-family: monospace; color: #007AFF;">DIWAN • ASHLEY APPROVED</div>
          <div style="font-size: 6px; color: #007AFF;">★ ★ ★</div>
        </div>
      </div>
    </div>

  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 600);
    };
  </script>
</body>
</html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

