/**
 * Ashley Universal PDF & CSV Export Utility & Smart 15-Minute Tolerance Color Engine
 * Generates pixel-perfect, full-width multi-page PDF documents and Excel-compatible CSVs with UTF-8 BOM.
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

/**
 * Convert 24-hour timestamp into 12-hour format with Kurdish indicators (ب.ن / پ.ن)
 * Example: '08:30:00' -> '08:30 ب.ن', '17:15' -> '05:15 پ.ن', '00:00:00' -> '12:00 شەو'
 */
export function formatTime12H(timeStr?: string | null): string {
  if (!timeStr) return '-';
  let timePart = String(timeStr).trim();
  if (timePart.includes('T')) {
    const splitT = timePart.split('T')[1];
    if (splitT) timePart = splitT.split('.')[0] || splitT;
  } else if (timePart.includes(' ')) {
    const parts = timePart.split(' ');
    timePart = parts[parts.length - 1] || timePart;
  }

  const chunks = timePart.split(':');
  if (chunks.length < 2) return timeStr;

  let hour = parseInt(chunks[0], 10);
  const minute = chunks[1].slice(0, 2);

  if (isNaN(hour)) return timeStr;

  if (hour === 0 && (minute === '00' || minute === '0')) {
    return '12:00 شەو';
  }

  const isPM = hour >= 12;
  hour = hour % 12;
  if (hour === 0) hour = 12;

  const hourStr = hour.toString().padStart(2, '0');
  const periodStr = isPM ? 'پ.ن' : 'ب.ن';

  return `${hourStr}:${minute} ${periodStr}`;
}

/**
 * 🌟 Smart Status Color Determination based on the Ashley 15-Minute Tolerance Rule:
 * 
 * Check-In (Base 08:00 AM / 480 mins):
 * - Early or On-Time up to 08:15 (<= 495 mins) -> 🟢 GREEN (ڕێکوپێک)
 * - Late arrival (> 08:15 / > 495 mins) -> 🔴 RED (دواکەوتوو)
 * 
 * Check-Out (Base 05:00 PM / 17:00 / 1020 mins):
 * - Early departure (< 16:45 / < 1005 mins) -> 🔴 RED (ڕۆیشتنی پێشوەختە)
 * - On-time departure (16:45 to 17:15 / 1005 to 1035 mins) -> 🟢 GREEN (ئاسایی و بێ کێشە)
 * - Overtime departure (> 17:15 / > 1035 mins OR 00:00 - 06:00 midnight) -> 🟣 PURPLE (ئیزافە و کاتی زیادە)
 */
export function getAttendanceTimeBadge(timeStr: string | null | undefined, type: 'in' | 'out'): {
  status: 'on_time' | 'late' | 'early_leave' | 'overtime';
  colorClass: string;
  cssClass: string;
  badgeStyle: { bg: string; color: string; border: string };
  label: string;
} {
  if (!timeStr || timeStr === '-' || timeStr === '') {
    return {
      status: 'on_time',
      colorClass: 'bg-slate-100 text-slate-500 border-slate-300',
      cssClass: 'badge-empty',
      badgeStyle: { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
      label: '-',
    };
  }

  let cleanTime = timeStr.trim();
  if (cleanTime.includes('T')) cleanTime = cleanTime.split('T')[1]?.split('.')[0] || cleanTime;
  if (cleanTime.includes(' ')) {
    const parts = cleanTime.split(' ');
    cleanTime = parts[parts.length - 1] || cleanTime;
  }
  
  const [hStr, mStr] = cleanTime.split(':');
  const hours = parseInt(hStr || '0', 10);
  const minutes = parseInt(mStr || '0', 10);
  const rawMins = hours * 60 + minutes;

  if (type === 'in') {
    // 08:00 is 480 mins. Up to 08:15 (495 mins) is GREEN. After 08:15 is RED.
    if (rawMins <= 495) {
      return {
        status: 'on_time',
        colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        cssClass: 'badge-ontime',
        badgeStyle: { bg: '#ecfdf5', color: '#065f46', border: '#10b981' },
        label: 'هاتن (ڕێکوپێک)',
      };
    } else {
      return {
        status: 'late',
        colorClass: 'bg-rose-50 text-rose-800 border-rose-300',
        cssClass: 'badge-late',
        badgeStyle: { bg: '#fef2f2', color: '#991b1b', border: '#f87171' },
        label: 'هاتن (دواکەوتوو)',
      };
    }
  } else {
    // Check-out: 17:00 is 1020 mins.
    // 🌟 Midnight & Overnight Support: 00:00 (12 AM) to 06:00 (6 AM) is 1440+ mins (Night Overtime)
    const effectiveOutMins = rawMins <= 360 ? rawMins + 1440 : rawMins;

    if (effectiveOutMins < 1005) {
      // Early leave (before 16:45)
      return {
        status: 'early_leave',
        colorClass: 'bg-rose-50 text-rose-800 border-rose-300',
        cssClass: 'badge-early',
        badgeStyle: { bg: '#fef2f2', color: '#991b1b', border: '#f87171' },
        label: 'ڕۆیشتن (پێشوەختە)',
      };
    } else if (effectiveOutMins <= 1035) {
      // On-time (16:45 to 17:15)
      return {
        status: 'on_time',
        colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        cssClass: 'badge-ontime',
        badgeStyle: { bg: '#ecfdf5', color: '#065f46', border: '#10b981' },
        label: 'ڕۆیشتن (تەواو)',
      };
    } else {
      // Overtime (> 17:15, 20:00, 23:00, 00:00 midnight)
      return {
        status: 'overtime',
        colorClass: 'bg-purple-100 text-purple-900 border-purple-400 font-black',
        cssClass: 'badge-overtime',
        badgeStyle: { bg: '#f5f3ff', color: '#581c87', border: '#a855f7' },
        label: 'ڕۆیشتن (ئیزافە)',
      };
    }
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
    kpiNotes = [],
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
  const currentTimeStr = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
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

    /* 🌟 ASHLEY 15-MINUTE SMART COLOR TOLERANCE BADGES */
    .badge-ontime {
      background: #ecfdf5 !important;
      color: #065f46 !important;
      border: 1.5px solid #10b981 !important;
      padding: 2.5px 8px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
    }
    .badge-late, .badge-early {
      background: #fef2f2 !important;
      color: #991b1b !important;
      border: 1.5px solid #f87171 !important;
      padding: 2.5px 8px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
    }
    .badge-overtime {
      background: #f5f3ff !important;
      color: #581c87 !important;
      border: 1.5px solid #a855f7 !important;
      padding: 2.5px 8px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
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
                  formattedCell = `<span class="badge-edited">✏️ ${val}</span>`;
                } else if (lowerKey.includes('in') || lowerKey.includes('هاتن') || lowerVal.includes('📥')) {
                  const badge = getAttendanceTimeBadge(val, 'in');
                  formattedCell = `<span class="${badge.cssClass}">📥 ${val.replace('📥', '').trim()}</span>`;
                } else if (lowerKey.includes('out') || lowerKey.includes('ڕۆشتن') || lowerKey.includes('دەرچوون') || lowerVal.includes('📤')) {
                  const badge = getAttendanceTimeBadge(val, 'out');
                  formattedCell = `<span class="${badge.cssClass}">📤 ${val.replace('📤', '').trim()}</span>`;
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
