/**
 * Ashley Universal PDF & CSV Export Utility
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
 * Example: '08:30:00' -> '08:30 ب.ن', '17:15' -> '05:15 پ.ن'
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

  const isPM = hour >= 12;
  hour = hour % 12;
  if (hour === 0) hour = 12;

  const hourStr = hour.toString().padStart(2, '0');
  const periodStr = isPM ? 'پ.ن' : 'ب.ن';

  return `${hourStr}:${minute} ${periodStr}`;
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
 * Generate full-width, multi-page, professional PDF Report with Print / Save as PDF
 */
export function exportToPDF(options: ExportReportOptions) {
  const {
    title,
    subtitle = 'کۆمپانیای ئاشڵی بۆ پیشەسازی و بازرگانی (Ashley Company ERP)',
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
      margin: 10mm 10mm 15mm 10mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
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
    
    /* Header styling */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #1e3a8a;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .header-titles h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: -0.5px;
    }
    .header-titles h2 {
      margin: 2px 0 0 0;
      font-size: 11px;
      font-weight: 700;
      color: #475569;
    }
    .header-meta {
      text-align: left;
      font-size: 10px;
      font-weight: bold;
      color: #334155;
    }
    .header-meta .badge {
      display: inline-block;
      background: #1e3a8a;
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10px;
      margin-bottom: 3px;
    }

    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(${Math.max(1, Math.min(summaryCards.length, 5))}, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      text-align: center;
    }
    .summary-card .label {
      font-size: 9.5px;
      font-weight: 800;
      color: #475569;
      display: block;
      margin-bottom: 2px;
    }
    .summary-card .value {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      font-family: monospace;
    }

    /* Main Table (Full Width & Multi-page repeat headers) */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 5px;
      page-break-inside: auto;
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
      background-color: #1e293b !important;
      color: #ffffff !important;
      font-weight: 800;
      font-size: 10px;
      padding: 6px 6px;
      border: 1px solid #334155;
      text-align: right;
    }
    td {
      padding: 5.5px 6px;
      border: 1px solid #cbd5e1;
      font-size: 10px;
      font-weight: 600;
      color: #1e293b;
    }
    tbody tr:nth-child(even) {
      background-color: #f8fafc !important;
    }
    tbody tr:hover {
      background-color: #f1f5f9 !important;
    }

    /* Footer & Signatures */
    .report-footer {
      margin-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 10px;
      border-top: 1px dashed #94a3b8;
      font-size: 9.5px;
      color: #64748b;
      page-break-inside: avoid;
    }
    .signature-box {
      text-align: center;
      width: 180px;
      border-top: 1px solid #475569;
      padding-top: 4px;
      font-weight: bold;
      color: #1e293b;
    }

    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>

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

    <!-- Table (Full Width) -->
    <table>
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">#</th>
          ${columns
            .map(
              c => `
          <th style="${c.width ? `width:${c.width};` : ''} text-align:${c.align || 'right'};">
            ${c.header}
          </th>
          `
            )
            .join('')}
        </tr>
      </thead>
      <tbody>
        ${
          data.length === 0
            ? `
        <tr>
          <td colspan="${columns.length + 1}" style="text-align: center; padding: 20px; color: #64748b;">
            هیچ داتایەک بۆ ئەم بەشە بوونی نییە.
          </td>
        </tr>
        `
            : data
                .map(
                  (row, idx) => `
        <tr>
          <td style="text-align: center; font-family: monospace; font-weight: bold; color: #64748b;">${idx + 1}</td>
          ${columns
            .map(
              c => `
          <td style="text-align:${c.align || 'right'};">
            ${row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '-'}
          </td>
          `
            )
            .join('')}
        </tr>
        `
                )
                .join('')
        }
      </tbody>
    </table>

    <!-- Footer & Signature -->
    <div class="report-footer">
      <div>
        <span>سیستەمی کارگێڕی و ژمێریاری ئاشڵی ASHLEY ERP 2026</span><br>
        <span>کۆی گشتی تۆمارەکان: ${data.length} دێڕ</span>
      </div>
      <div class="signature-box">
        واژوو و پەسەندکردنی ئەدمین
      </div>
    </div>

  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
