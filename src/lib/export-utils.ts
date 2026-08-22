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
  status: 'present' | 'absent' | 'off' | 'future';
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
    subtitle = 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی (Ashley Enterprise ERP)',
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
    subtitle = 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی (Ashley Enterprise ERP)',
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
