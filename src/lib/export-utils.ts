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
  summaryCards?: Array<{ label: string; value: string | number; color?: string; icon?: string }>;
  summaryText?: string;
  kpiNotes?: string[];
  orientation?: 'landscape' | 'portrait';
  fileName?: string;
  settings?: any;
  documentCode?: string;
  reportType?: 'overtime' | 'expenses' | 'bonuses' | 'withdrawals' | 'general';
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
  monthlyOvertimeStr?: string;
  monthlyOvertimeHours?: number;
  adminNote?: string;
  status: 'present' | 'absent' | 'off' | 'future' | 'leave';
  isWaived?: boolean;
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
  settings?: any;
  documentCode?: string;
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
    orientation = 'portrait',
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

  let activeSettings = options.settings;
  if (!activeSettings && typeof window !== 'undefined') {
    try {
      const stored = 
        localStorage.getItem('ashley_terminal_settings') ||
        localStorage.getItem('ashley_global_settings') ||
        localStorage.getItem('ashley_app_settings');
      if (stored) {
        activeSettings = JSON.parse(stored);
      }
    } catch {
      // fallback
    }
  }

  const motherCompany = activeSettings?.motherCompanyName || 'کۆمپانیای گروپی دیوان';
  const motherCompanySubtitle = activeSettings?.motherCompanySubtitle || 'ناسنامەی مۆبیلیات';
  const brandName = activeSettings?.brandName || 'کۆمپانیای مۆبیلیاتی ئاشڵی';
  const brandSubtitle = activeSettings?.brandSubtitle || activeSettings?.brandSlogan || activeSettings?.agencyTitle || 'Inspire Your Home (ئیلهام بەخشین بە ماڵەکەت)';
  const diwanLogo = activeSettings?.diwanLogo || '/diwan-logo.svg';
  const reportLogo = activeSettings?.reportLogo || activeSettings?.ashleyLogo || activeSettings?.websiteLogo || activeSettings?.appLogo || '/ashley-logo.svg';
  const primaryColor = activeSettings?.letterheadPrimaryColor || '#0f172a';
  const accentColor = activeSettings?.letterheadAccentColor || '#d97706';
  const titleColor = activeSettings?.letterheadTitleColor || primaryColor;
  const docCode = options.documentCode || 'ASH-ERP-2026';

  const html = `
<!DOCTYPE html>
<html lang="ku" dir="rtl">
<head>
  <base href="${typeof window !== 'undefined' ? window.location.origin : ''}/">
  <meta charset="UTF-8">
  <title>${title} - ${fileName}</title>
  <style>
    @page {
      size: ${orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
      margin: 8mm 8mm 10mm 8mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    @font-face {
      font-family: 'NRT';
      src: url('/fonts/NRT-Reg.woff') format('woff'),
           url('/fonts/NRT-Reg.ttf') format('truetype');
      font-weight: 400 500;
      font-style: normal;
    }
    @font-face {
      font-family: 'NRT';
      src: url('/fonts/NRT-Bd.woff') format('woff'),
           url('/fonts/NRT-Bd.ttf') format('truetype');
      font-weight: 600 900;
      font-style: normal;
    }
    body {
      font-family: 'NRT', 'Vazirmatn', 'Segoe UI', Tahoma, Arial, sans-serif;
      margin: 0;
      padding: 10px;
      color: #0f172a;
      background: #ffffff;
      font-size: 10.5px;
      line-height: 1.4;
      direction: rtl;
    }
    .report-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    
    /* 🏛️ OFFICIAL DUAL-BRAND ERP LETTERHEAD */
    .official-letterhead {
      border-bottom: 2.5px solid ${primaryColor};
      padding-bottom: 10px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      width: 100%;
    }
    .letterhead-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      justify-content: flex-start;
      text-align: right;
    }
    .letterhead-center {
      flex: 1.6;
      text-align: center;
      padding: 0 8px;
    }
    .letterhead-center .doc-badge {
      display: inline-block;
      font-size: 8px;
      font-weight: 800;
      color: #d97706;
      background: #fef3c7;
      border: 1px solid #fde68a;
      padding: 1.5px 8px;
      border-radius: 10px;
      margin-bottom: 3px;
      letter-spacing: 0.2px;
    }
    .letterhead-center h1 {
      margin: 0;
      font-size: 15.5px;
      font-weight: 900;
      color: ${titleColor};
      letter-spacing: -0.2px;
      line-height: 1.25;
    }
    .letterhead-center .period-badge {
      font-size: 10px;
      font-weight: 800;
      color: #475569;
      margin-top: 3px;
      display: inline-block;
      background: #f1f5f9;
      padding: 2px 10px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .letterhead-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      justify-content: flex-end;
      text-align: left;
    }
    .company-title {
      font-size: 12px;
      font-weight: 900;
      color: ${primaryColor};
      line-height: 1.2;
    }
    .company-subtitle {
      font-size: 9px;
      font-weight: 800;
      color: ${accentColor};
      margin-top: 1px;
    }
    .meta-code {
      font-size: 8px;
      font-family: Consolas, monospace;
      color: #64748b;
      margin-top: 2px;
    }
    .letterhead-logo {
      max-height: 44px;
      max-width: 120px;
      object-fit: contain;
    }

    /* 📊 MODERN EXECUTIVE ERP KPI CARDS */
    .erp-kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .erp-kpi-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-top: 3.5px solid #2563eb;
      border-radius: 6px;
      padding: 6px 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .erp-kpi-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 9px;
      font-weight: 800;
      color: #64748b;
      margin-bottom: 2px;
    }
    .erp-kpi-card-val {
      font-size: 13.5px;
      font-weight: 900;
      color: #0f172a;
      font-family: 'NRT', Consolas, monospace;
      white-space: nowrap;
      text-align: right;
      direction: ltr;
    }

    /* 📝 EXECUTIVE NARRATIVE SUMMARY RIBBON */
    .executive-summary-ribbon {
      background: #f8fafc !important;
      border: 1px solid #cbd5e1 !important;
      border-right: 4.5px solid ${primaryColor} !important;
      border-radius: 6px;
      padding: 7px 12px;
      margin-bottom: 10px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      font-size: 10.5px;
      line-height: 1.5;
      color: #1e293b;
      page-break-inside: avoid;
    }
    .summary-ribbon-title {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 900;
      color: ${primaryColor};
      white-space: nowrap;
      padding-left: 10px;
      border-left: 1.5px solid #cbd5e1;
      font-size: 10.5px;
    }
    .summary-ribbon-text {
      flex: 1;
      font-weight: 700;
      color: #334155;
    }

    /* 📋 HIGH-PRECISION ERP TABLE STYLING */
    table {
      width: 100% !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      margin-top: 4px;
      page-break-inside: auto;
      border: 1px solid #cbd5e1 !important;
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
    thead th {
      background: #0f172a !important;
      color: #ffffff !important;
      font-weight: 900;
      font-size: 10px;
      padding: 7px 8px;
      border-left: 1px solid #334155;
      border-bottom: 2px solid #0f172a;
      text-align: right;
      letter-spacing: -0.2px;
    }
    thead th:last-child {
      border-left: none;
    }
    tbody td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      border-left: 1px solid #f1f5f9;
      font-size: 10px;
      font-weight: 700;
      color: #1e293b;
      vertical-align: middle;
    }
    tbody td:last-child {
      border-left: none;
    }
    tbody tr.tr-data-row:nth-child(even) {
      background-color: #f8fafc !important;
    }
    tbody tr.tr-data-row:nth-child(odd) {
      background-color: #ffffff !important;
    }

    /* Subtotal Rows (Light Yellow Highlight) */
    tbody tr.tr-subtotal-row {
      background-color: #fef9c3 !important;
      border-top: 1.5px dashed #ca8a04 !important;
      border-bottom: 1.5px solid #eab308 !important;
    }
    tbody tr.tr-subtotal-row td {
      font-weight: 800 !important;
      color: #713f12 !important;
      background-color: #fef9c3 !important;
    }

    /* Grand Total Row */
    tbody tr.tr-grand-total-row {
      background: #0f172a !important;
      border-top: 2.5px solid #d97706 !important;
      border-bottom: 2.5px solid #0f172a !important;
    }
    tbody tr.tr-grand-total-row td {
      color: #ffffff !important;
      font-weight: 900 !important;
      font-size: 11px !important;
      padding: 7px 9px !important;
      background: #0f172a !important;
    }

    /* 🏷️ SPECIALIZED ERP BADGES */
    .badge-money {
      background: #ecfdf5 !important;
      color: #065f46 !important;
      border: 1.5px solid #10b981 !important;
      padding: 2px 7px;
      border-radius: 5px;
      font-weight: 900;
      font-family: Consolas, monospace;
      display: inline-block;
      white-space: nowrap;
      font-size: 10px;
      direction: ltr;
    }
    .badge-money-subtotal {
      background: #fef08a !important;
      color: #854d0e !important;
      border: 1.5px solid #ca8a04 !important;
      font-size: 10.5px;
    }
    .badge-money-grand {
      background: #10b981 !important;
      color: #ffffff !important;
      border: 1.5px solid #059669 !important;
      font-size: 11.5px !important;
      padding: 3px 9px !important;
      font-family: Consolas, monospace;
    }
    .badge-ot {
      background: #fffbeb !important;
      color: #b45309 !important;
      border: 1.5px solid #f59e0b !important;
      padding: 2px 7px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
      font-size: 10px;
    }
    .badge-ot-grand {
      background: #f59e0b !important;
      color: #ffffff !important;
      border-color: #d97706 !important;
      font-size: 11px !important;
      padding: 2.5px 8px !important;
    }
    .badge-out-time {
      background: #f0f9ff !important;
      color: #0369a1 !important;
      border: 1.5px solid #0284c7 !important;
      padding: 2px 7px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
      font-family: Consolas, monospace;
      font-size: 10px;
    }
    .badge-in-time {
      background: #ecfdf5 !important;
      color: #065f46 !important;
      border: 1.5px solid #10b981 !important;
      padding: 2px 7px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
      font-family: Consolas, monospace;
      font-size: 10px;
    }
    .badge-empty {
      color: #94a3b8;
      font-weight: bold;
    }
    .badge-date {
      background: #f8fafc !important;
      color: #0f172a !important;
      border: 1px solid #cbd5e1 !important;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 800;
      font-family: Consolas, monospace;
      display: inline-block;
      white-space: nowrap;
      font-size: 9.5px;
    }
    .badge-role {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #e2e8f0;
      padding: 1.5px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      display: inline-block;
      white-space: nowrap;
    }
    .badge-type {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 7px;
      border-radius: 5px;
      font-size: 9.5px;
      font-weight: 800;
      white-space: nowrap;
    }
    .badge-taxi {
      background: #fef3c7 !important;
      color: #92400e !important;
      border: 1px solid #fcd34d !important;
    }
    .badge-fuel {
      background: #fee2e2 !important;
      color: #991b1b !important;
      border: 1px solid #fca5a5 !important;
    }
    .badge-food {
      background: #ffedd5 !important;
      color: #9a3412 !important;
      border: 1px solid #fdba74 !important;
    }
    .badge-office {
      background: #e0e7ff !important;
      color: #3730a3 !important;
      border: 1px solid #a5b4fc !important;
    }
    .badge-other {
      background: #f1f5f9 !important;
      color: #475569 !important;
      border: 1px solid #cbd5e1 !important;
    }
    .badge-trip {
      background: #f1f5f9 !important;
      color: #1e293b !important;
      border: 1px solid #cbd5e1 !important;
      padding: 1.5px 6px;
      border-radius: 10px;
      font-size: 9px;
      font-weight: 800;
      display: inline-block;
    }
    .badge-loc {
      font-size: 9.5px;
      color: #334155;
      font-weight: 700;
    }
    .badge-edited {
      background: #eff6ff !important;
      color: #1e40af !important;
      border: 1.5px solid #60a5fa !important;
      padding: 2px 7px;
      border-radius: 5px;
      font-weight: 900;
      display: inline-block;
      white-space: nowrap;
    }

    /* ✍️ OFFICIAL SIGNATURE BOX (SINGLE: بەڕێوەبەری کۆگا) */
    .report-signatures {
      margin-top: 18px;
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
      break-inside: avoid;
      direction: rtl;
    }
    .signature-card {
      width: 220px;
      background: #f8fafc;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1.5px solid #cbd5e1;
      text-align: center;
    }
    .signature-role {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      text-align: center;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .signature-line {
      font-size: 9.5px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 6px;
      text-align: right;
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
    <!-- 🏛️ OFFICIAL DUAL-BRAND ERP LETTERHEAD -->
    <div class="official-letterhead">
      <!-- 1. Right: Mother Company & Diwan Logo -->
      <div class="letterhead-right">
        <img src="${diwanLogo}" alt="${motherCompany}" class="letterhead-logo" onerror="this.style.display='none'">
        <div>
          <div class="company-title">${motherCompany}</div>
          <div class="company-subtitle">${motherCompanySubtitle}</div>
        </div>
      </div>

      <!-- 2. Center: Document Title & Metadata -->
      <div class="letterhead-center">
        <div class="doc-badge">سیستەمی کارگێڕی و ژمێریاری • Ashley ERP</div>
        <h1>${title}</h1>
        ${period ? `<div class="period-badge">ماوە / بەروار: ${period}</div>` : (subtitle ? `<div class="period-badge">${subtitle}</div>` : '')}
      </div>

      <!-- 3. Left: Brand Name, Code, Logo -->
      <div class="letterhead-left">
        <div>
          <div class="company-title">${brandName}</div>
          <div class="company-subtitle">${brandSubtitle}</div>
          <div class="meta-code">${currentDateStr} (${currentTimeStr}) • کۆد: ${docCode}</div>
        </div>
        <img src="${reportLogo}" alt="${brandName}" class="letterhead-logo" onerror="this.style.display='none'">
      </div>
    </div>



    <!-- 📋 Main Data Table -->
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
            (row, index) => {
              const isGrandTotalRow = Object.values(row).some(
                v => typeof v === 'string' && (v.includes('⭐') || v.includes('کۆی گشتی'))
              );
              const isSubtotalRow = !isGrandTotalRow && (Boolean((row as any).isSubtotal) || Object.values(row).some(
                v => typeof v === 'string' && (v.includes('📊 کۆی') || v.includes('کۆی مەسروفاتی') || v.includes('کۆی ئەو کارمەندە') || v.includes('کۆی ئەم کارمەندە'))
              ));

              let trClass = 'tr-data-row';
              if (isGrandTotalRow) trClass = 'tr-grand-total-row';
              else if (isSubtotalRow) trClass = 'tr-subtotal-row';

              return `
          <tr class="${trClass}">
            <td style="text-align: center; color: ${isGrandTotalRow ? '#ffffff' : (isSubtotalRow ? '#713f12' : '#64748b')}; font-family: monospace; font-weight: 800;">${isGrandTotalRow ? '★' : (isSubtotalRow ? '•' : index + 1)}</td>
            ${columns
              .map(col => {
                const val = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : '-';
                
                let formattedCell = val;
                const lowerKey = col.key.toLowerCase();
                const lowerVal = val.toLowerCase();

                if (isGrandTotalRow) {
                  if (lowerKey.includes('amount') || lowerKey.includes('cost') || lowerKey.includes('pay') || lowerVal.includes('iqd')) {
                    formattedCell = `<span class="badge-money-grand">${val}</span>`;
                  } else if (lowerKey.includes('hour') || lowerKey.includes('overtime')) {
                    formattedCell = `<span class="badge-ot-grand">${val}</span>`;
                  } else {
                    formattedCell = `<strong>${val}</strong>`;
                  }
                } else if (isSubtotalRow) {
                  if (lowerKey.includes('amount') || lowerKey.includes('cost') || lowerKey.includes('pay') || lowerVal.includes('iqd')) {
                    formattedCell = `<span class="badge-money badge-money-subtotal">${val}</span>`;
                  } else {
                    formattedCell = `<strong>${val}</strong>`;
                  }
                } else {
                  // Normal Data Rows
                  if (lowerVal.includes('گۆڕاو') || lowerVal.includes('دەستکاریکراو') || lowerVal.includes('edited') || lowerVal.includes('modified') || lowerKey.includes('edit')) {
                    formattedCell = `<span class="badge-edited">✏️ ${formatTime24H(val)}</span>`;
                  } else if (lowerKey.includes('in') || lowerKey.includes('هاتن') || lowerVal.includes('📥')) {
                    const badge = getAttendanceTimeBadge(val, 'in');
                    formattedCell = `<span class="${badge.cssClass}">📥 ${badge.formattedTime}</span>`;
                  } else if (lowerKey.includes('checkout') || lowerKey.includes('out') || lowerKey.includes('دەرچوون') || lowerKey.includes('چون') || lowerVal.includes('📤')) {
                    if (val !== '-' && val !== '—') {
                      formattedCell = `<span class="badge-out-time">🕒 ${formatTime24H(val)}</span>`;
                    } else {
                      formattedCell = `<span class="badge-empty">—</span>`;
                    }
                  } else if (lowerKey.includes('date') || lowerKey.includes('بەروار') || /^\d{4}-\d{2}-\d{2}$/.test(val)) {
                    formattedCell = `<span class="badge-date">📅 ${val}</span>`;
                  } else if (lowerKey === 'type' || lowerKey === 'category' || lowerKey.includes('جۆر')) {
                    if (val.includes('تەکسی') || lowerVal.includes('taxi')) {
                      formattedCell = `<span class="badge-type badge-taxi">🚕 ${val}</span>`;
                    } else if (val.includes('بەنزین') || lowerVal.includes('fuel')) {
                      formattedCell = `<span class="badge-type badge-fuel">⛽ ${val}</span>`;
                    } else if (val.includes('خواردن') || lowerVal.includes('food')) {
                      formattedCell = `<span class="badge-type badge-food">🍔 ${val}</span>`;
                    } else if (val.includes('مەکتەب') || lowerVal.includes('office')) {
                      formattedCell = `<span class="badge-type badge-office">🏢 ${val}</span>`;
                    } else if (val !== '-' && val !== '—') {
                      formattedCell = `<span class="badge-type badge-other">📦 ${val}</span>`;
                    }
                  } else if (lowerKey.includes('trip') || lowerKey.includes('سەفەر')) {
                    if (val !== '-' && val !== '—') {
                      formattedCell = `<span class="badge-trip">🚗 ${val}</span>`;
                    } else {
                      formattedCell = `<span style="color:#94a3b8;">—</span>`;
                    }
                  } else if (lowerKey === 'from' || lowerKey === 'to') {
                    if (val !== '-' && val !== '—') {
                      formattedCell = `<span class="badge-loc">${lowerKey === 'from' ? '📍 لە: ' : '🏁 بۆ: '}${val}</span>`;
                    } else {
                      formattedCell = `<span style="color:#94a3b8;">—</span>`;
                    }
                  } else if (lowerKey.includes('amount') || lowerKey.includes('cost') || lowerKey.includes('pay') || lowerVal.includes('iqd')) {
                    formattedCell = `<span class="badge-money">${val}</span>`;
                  } else if (lowerKey.includes('hour') || lowerKey.includes('overtime') || lowerVal.includes('کاتژمێر')) {
                    formattedCell = `<span class="badge-ot">⚡ ${val}</span>`;
                  } else if (lowerKey.includes('role') || lowerKey.includes('پۆست')) {
                    formattedCell = `<span class="badge-role">${val}</span>`;
                  }
                }

                return `
                  <td style="text-align: ${col.align || 'right'};">
                    ${formattedCell}
                  </td>
                `;
              })
              .join('')}
          </tr>
        `;
            }
          )
          .join('')}
      </tbody>
    </table>

    <!-- ✍️ شوێنی واژووی فەرمی (تەنها یەک شوێنی واژوو: بەڕێوەبەری کۆگا) -->
    <div class="report-signatures">
      <div class="signature-card">
        <div class="signature-role">بەڕێوەبەری کۆگا</div>
        <div class="signature-line">بەروار: ..... / ..... / 2026</div>
        <div class="signature-line" style="margin-bottom: 0;">واژوو و مۆر: .......................................</div>
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

  let activeSettings = options.settings;
  if (!activeSettings && typeof window !== 'undefined') {
    try {
      const stored = 
        localStorage.getItem('ashley_terminal_settings') ||
        localStorage.getItem('ashley_global_settings') ||
        localStorage.getItem('ashley_app_settings');
      if (stored) {
        activeSettings = JSON.parse(stored);
      }
    } catch {
      // fallback
    }
  }

  const motherCompany = activeSettings?.motherCompanyName || 'کۆمپانیای گروپی دیوان';
  const motherCompanySubtitle = activeSettings?.motherCompanySubtitle || 'ناسنامەی مۆبیلیات';
  const brandName = activeSettings?.brandName || 'کۆمپانیای مۆبیلیاتی ئاشڵی';
  const brandSubtitle = activeSettings?.brandSubtitle || activeSettings?.brandSlogan || 'Inspire Your Home (ئیلهام بەخشین بە ماڵەکەت)';
  const diwanLogo = activeSettings?.diwanLogo || '/diwan-logo.svg';
  const reportLogo = activeSettings?.reportLogo || activeSettings?.ashleyLogo || activeSettings?.appLogo || '/ashley-logo.png';
  const primaryColor = activeSettings?.letterheadPrimaryColor || '#0f172a';
  const accentColor = activeSettings?.letterheadAccentColor || '#d97706';
  const titleColor = activeSettings?.letterheadTitleColor || primaryColor;
  const docCode = options.documentCode || `ASH-DGP-${month}`;

  const pagesHtml = daysData.map((day, dayIndex) => {
    const isLast = dayIndex === daysData.length - 1;

    return `
    <div class="daily-page-container ${isLast ? 'last-page' : ''}">
      <!-- 🌟 OFFICIAL 3-PART ASHLEY LETTERHEAD -->
      <div class="official-letterhead">
        <!-- 1. لای ڕاست: لۆگۆ و ناوی گروپی دیوان -->
        <div class="letterhead-right">
          <img src="${diwanLogo}" alt="Diwan Logo" class="letterhead-logo" onerror="this.style.display='none'">
          <div>
            <div class="company-title">${motherCompany}</div>
            <div class="company-subtitle">${motherCompanySubtitle}</div>
          </div>
        </div>

        <!-- 2. ناوەڕاست: تەنها تایتڵی فەرمی بابەتەکە -->
        <div class="letterhead-center">
          <h1>${title}</h1>
          <div class="period-badge">📅 ${day.dayName} (${day.dateStr}) — لاپەڕەی ${day.dayNum} لە ${daysData.length}</div>
        </div>

        <!-- 3. لای چەپ: ناوی ئاشڵی، بەروار و کۆد و لۆگۆی ئاشڵی -->
        <div class="letterhead-left">
          <div>
            <div class="company-title">${brandName}</div>
            <div class="company-subtitle">${brandSubtitle}</div>
            <div class="meta-code">${currentDateStr} • کۆدی دەرچوون: ${docCode}</div>
          </div>
          <img src="${reportLogo}" alt="Ashley Logo" class="letterhead-logo" onerror="this.style.display='none'">
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

      <!-- ✍️ Official Signature Box (Single: بەڕێوەبەری کۆگا) -->
      <div class="report-signatures">
        <div class="signature-card">
          <div class="signature-role">بەڕێوەبەری کۆگا</div>
          <div class="signature-line">بەروار: ..... / ..... / 2026</div>
          <div class="signature-line" style="margin-bottom: 0;">واژوو و مۆر: .......................................</div>
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
    @font-face {
      font-family: 'NRT';
      src: url('/fonts/NRT-Reg.woff') format('woff'),
           url('/fonts/NRT-Reg.ttf') format('truetype');
      font-weight: 400 500;
      font-style: normal;
    }
    @font-face {
      font-family: 'NRT';
      src: url('/fonts/NRT-Bd.woff') format('woff'),
           url('/fonts/NRT-Bd.ttf') format('truetype');
      font-weight: 600 900;
      font-style: normal;
    }
    body {
      font-family: 'NRT', 'Vazirmatn', 'Segoe UI', Tahoma, Arial, sans-serif;
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

    /* 🌟 OFFICIAL 3-PART ASHLEY LETTERHEAD */
    .official-letterhead {
      border-bottom: 2.5px solid ${primaryColor};
      padding-bottom: 6px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      width: 100%;
    }
    .letterhead-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      justify-content: flex-start;
      text-align: right;
    }
    .letterhead-center {
      flex: 1.6;
      text-align: center;
      padding: 0 6px;
    }
    .letterhead-center h1 {
      margin: 0;
      font-size: 14px;
      font-weight: 900;
      color: ${titleColor};
      letter-spacing: -0.2px;
      line-height: 1.2;
    }
    .letterhead-center .period-badge {
      font-size: 9.5px;
      font-weight: bold;
      color: #64748b;
      margin-top: 2px;
    }
    .letterhead-left {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      justify-content: flex-end;
      text-align: left;
    }
    .company-title {
      font-size: 11px;
      font-weight: 900;
      color: ${primaryColor};
      line-height: 1.2;
    }
    .company-subtitle {
      font-size: 8.5px;
      font-weight: 800;
      color: ${accentColor};
      margin-top: 1px;
    }
    .meta-code {
      font-size: 7.5px;
      font-family: Consolas, monospace;
      color: #64748b;
      margin-top: 1px;
    }
    .letterhead-logo {
      max-height: 38px;
      max-width: 100px;
      object-fit: contain;
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

    /* ✍️ Official Signature Box (Single: بەڕێوەبەری کۆگا) */
    .report-signatures {
      margin-top: 10px;
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
      break-inside: avoid;
      direction: rtl;
    }
    .signature-card {
      width: 200px;
      background: #f8fafc;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      text-align: center;
    }
    .signature-role {
      font-size: 9.5px;
      font-weight: 800;
      color: #0f172a;
      text-align: center;
      margin-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
    }
    .signature-line {
      font-size: 8px;
      font-weight: 700;
      color: #475569;
      margin-bottom: 4px;
      text-align: right;
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
    @font-face {
      font-family: 'NRT';
      src: url('/fonts/NRT-Reg.woff') format('woff'),
           url('/fonts/NRT-Reg.ttf') format('truetype');
      font-weight: 400 500;
      font-style: normal;
    }
    @font-face {
      font-family: 'NRT';
      src: url('/fonts/NRT-Bd.woff') format('woff'),
           url('/fonts/NRT-Bd.ttf') format('truetype');
      font-weight: 600 900;
      font-style: normal;
    }
    @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap');
    
    * { box-sizing: border-box; }
    body {
      font-family: 'NRT', 'Vazirmatn', -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif;
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

      <!-- Center: Clean Subject Document Title (هیچ دەقێک لەژێر ئەم تایتڵە نانووسرێت) -->
      <div class="center-branding" style="flex: 1.6; text-align: center; padding: 0 8px;">
        <h1 style="font-size: 16px; font-weight: 900; color: ${titleColor}; margin: 0; line-height: 1.2; letter-spacing: -0.2px;">
          ${docTitle}
        </h1>
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

    <!-- ڕوونکردنەوەی خشتەکە لەسەر خشتەکە (Table Explanation Strip) -->
    <div style="margin-bottom: 8px; padding: 6px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; font-weight: 700; color: #334155;">
      <div>
        <span>📋 <strong>ڕوونکردنەوەی خشتە:</strong> تۆماری فەرمی ئامادەبوونی کارمەندان بۆ مانگی <strong>${month}</strong> • دەوامی فەرمی: 08:00 هاتن - 17:00 دەرچوون • مەرجی درەنگکەوتن: پاش 08:15</span>
      </div>
      <div style="font-family: monospace; color: #64748b; font-size: 8.5px;">
        <span>بەرواری دەرچوون: ${issueDate} • کۆدی بەڵگەنامە: ASH-DGP-${month}</span>
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

    <!-- ✍️ شوێنی واژووی فەرمی (تەنها یەک شوێنی واژوو: بەڕێوەبەری کۆگا) -->
    <div style="margin-top: 20px; display: flex; justify-content: flex-end; page-break-inside: avoid; break-inside: avoid; direction: rtl;">
      <div style="width: 220px; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1.5px solid #cbd5e1; text-align: center;">
        <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-align: center; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
          بەڕێوەبەری کۆگا
        </div>
        <div style="font-size: 9.5px; font-weight: 700; color: #475569; margin-bottom: 6px; text-align: right;">
          بەروار: ..... / ..... / 2026
        </div>
        <div style="font-size: 9.5px; font-weight: 700; color: #475569; text-align: right;">
          واژوو و مۆر: .......................................
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

