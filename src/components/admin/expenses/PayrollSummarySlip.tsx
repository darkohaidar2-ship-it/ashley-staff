'use client';

import React, { useState, useMemo } from 'react';
import { 
  DollarSign, 
  Printer, 
  FileSpreadsheet, 
  Search, 
  TrendingUp, 
  Gift, 
  Clock, 
  Banknote, 
  UserCheck, 
  Layers,
  Sparkles,
  Download,
  AlertCircle
} from 'lucide-react';
import type { Employee, Expense, Bonus, Overtime, CashWithdrawal } from '@/lib/types';
import { exportToPDF, exportToCSV, type ExportTableColumn } from '@/lib/export-utils';

interface PayrollSummarySlipProps {
  employees: Employee[];
  expenses: Expense[];
  bonuses: Bonus[];
  overtime: Overtime[];
  withdrawals: CashWithdrawal[];
  selectedMonth: string;
  monthDisplayLabel: string;
  tableDensity: 'cozy' | 'compact';
  onLogAudit?: (action: 'create' | 'update' | 'delete', entity: string, description: string) => void;
}

export interface EmployeePayrollItem {
  empId: string;
  empName: string;
  role: string;
  baseSalary: number;
  bonusesTotal: number;
  bonusCount: number;
  overtimeTotal: number;
  overtimeHours: number;
  withdrawalsTotal: number;
  withdrawalCount: number;
  personalExpensesTotal: number;
  personalExpenseCount: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

export function PayrollSummarySlip({
  employees = [],
  expenses = [],
  bonuses = [],
  overtime = [],
  withdrawals = [],
  selectedMonth,
  monthDisplayLabel,
  tableDensity,
  onLogAudit,
}: PayrollSummarySlipProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const cellPad = tableDensity === 'compact' ? 'py-1.5 px-2.5 text-[11px]' : 'p-3 text-xs';

  // Compute payroll summary per active employee
  const payrollList: EmployeePayrollItem[] = useMemo(() => {
    return employees
      .filter(emp => emp.isActive !== false)
      .map(emp => {
        const empName = emp.fullName3Part || emp.name;
        const role = emp.role ? String(emp.role) : 'کارمەند';
        const baseSalary = Number((emp as any).baseSalary || (emp as any).salary || 0);

        // Bonuses for this employee in selected month
        const empBonuses = bonuses.filter(b => b.employeeId === emp.id);
        const bonusesTotal = empBonuses.reduce((sum, b: any) => sum + Number(b.totalAmount || b.amount || ((b.loadCount || 0) * (b.rate || 0)) || 0), 0);
        const bonusCount = empBonuses.length;

        // Overtime for this employee in selected month
        const empOvertime = overtime.filter(o => o.employeeId === emp.id);
        const overtimeTotal = empOvertime.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
        const overtimeHours = empOvertime.reduce((sum, o) => sum + Number(o.hours || 0), 0);

        // Withdrawals for this employee in selected month
        const empWithdrawals = withdrawals.filter(w => w.employeeId === emp.id);
        const withdrawalsTotal = empWithdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);
        const withdrawalCount = empWithdrawals.length;

        // Personal / Taxi Expenses tagged to this employee in selected month
        const empExpenses = expenses.filter(e => e.employeeId === emp.id);
        const personalExpensesTotal = empExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const personalExpenseCount = empExpenses.length;

        // Gross = Base + Bonuses + Overtime
        const grossPay = baseSalary + bonusesTotal + overtimeTotal;
        // Deductions = Cash Withdrawals
        const totalDeductions = withdrawalsTotal;
        // Net Pay = Gross - Deductions
        const netPay = grossPay - totalDeductions;

        return {
          empId: emp.id,
          empName,
          role,
          baseSalary,
          bonusesTotal,
          bonusCount,
          overtimeTotal,
          overtimeHours,
          withdrawalsTotal,
          withdrawalCount,
          personalExpensesTotal,
          personalExpenseCount,
          grossPay,
          totalDeductions,
          netPay,
        };
      })
      .sort((a, b) => b.netPay - a.netPay);
  }, [employees, expenses, bonuses, overtime, withdrawals]);

  // Filtered by Search
  const filteredPayroll = useMemo(() => {
    if (!searchQuery.trim()) return payrollList;
    const q = searchQuery.toLowerCase();
    return payrollList.filter(
      p => p.empName.toLowerCase().includes(q) || p.role.toLowerCase().includes(q)
    );
  }, [payrollList, searchQuery]);

  // Overall KPI Totals
  const totals = useMemo(() => {
    return filteredPayroll.reduce(
      (acc, item) => ({
        baseSalary: acc.baseSalary + item.baseSalary,
        bonuses: acc.bonuses + item.bonusesTotal,
        overtime: acc.overtime + item.overtimeTotal,
        withdrawals: acc.withdrawals + item.withdrawalsTotal,
        gross: acc.gross + item.grossPay,
        net: acc.net + item.netPay,
      }),
      { baseSalary: 0, bonuses: 0, overtime: 0, withdrawals: 0, gross: 0, net: 0 }
    );
  }, [filteredPayroll]);

  // 🖨️ Master Payroll Print Handler
  const handlePrintPayroll = () => {
    const cols: ExportTableColumn[] = [
      { key: 'index', header: '#', width: '5%', align: 'center' },
      { key: 'name', header: 'ناوی کارمەند', width: '25%', align: 'right' },
      { key: 'role', header: 'پلە / بەش', width: '15%', align: 'center' },
      { key: 'base', header: 'مووچەی بنەڕەتی', width: '12%', align: 'center' },
      { key: 'bonuses', header: 'پاداشت (+)', width: '10%', align: 'center' },
      { key: 'overtime', header: 'کاتی زیادە (+)', width: '11%', align: 'center' },
      { key: 'withdrawals', header: 'پێشینە / لێبڕین (-)', width: '11%', align: 'center' },
      { key: 'net', header: 'صافی مووچە (IQD)', width: '11%', align: 'center' },
    ];

    const data = filteredPayroll.map((item, idx) => ({
      index: idx + 1,
      name: item.empName,
      role: item.role,
      base: item.baseSalary > 0 ? `${item.baseSalary.toLocaleString()} IQD` : '—',
      bonuses: item.bonusesTotal > 0 ? `+${item.bonusesTotal.toLocaleString()} IQD` : '—',
      overtime: item.overtimeTotal > 0 ? `+${item.overtimeTotal.toLocaleString()} IQD` : '—',
      withdrawals: item.withdrawalsTotal > 0 ? `-${item.withdrawalsTotal.toLocaleString()} IQD` : '—',
      net: `${item.netPay.toLocaleString()} IQD`,
    }));

    // Add Total Summary Row
    data.push({
      index: '' as any,
      name: `کۆی گشتی بۆ ${filteredPayroll.length} کارمەند`,
      role: '—',
      base: `${totals.baseSalary.toLocaleString()} IQD`,
      bonuses: `+${totals.bonuses.toLocaleString()} IQD`,
      overtime: `+${totals.overtime.toLocaleString()} IQD`,
      withdrawals: `-${totals.withdrawals.toLocaleString()} IQD`,
      net: `${totals.net.toLocaleString()} IQD`,
    });

    exportToPDF({
      title: 'پوختەی مووچەی مانگانەی کارمەندان (Payroll Summary Slip)',
      subtitle: `حیساباتی دارایی و صافی شایستەی مووچە بۆ مانگی ${selectedMonth}`,
      period: monthDisplayLabel,
      columns: cols,
      data,
      orientation: 'landscape',
      fileName: `Ashley_Payroll_${selectedMonth}`,
      documentCode: `ASH-PAY-${selectedMonth.replace(/-/g, '')}`,
    });

    if (onLogAudit) {
      onLogAudit('create', 'payroll', `چاپی ڕاپۆرتی مووچەی مانگی (${selectedMonth}) بۆ ${filteredPayroll.length} کارمەند`);
    }
  };

  // 📥 Excel Export Handler
  const handleExportExcel = () => {
    const cols: ExportTableColumn[] = [
      { key: 'index', header: '#', width: '5%', align: 'center' },
      { key: 'name', header: 'ناوی کارمەند', width: '25%', align: 'right' },
      { key: 'role', header: 'بەش', width: '15%', align: 'center' },
      { key: 'base', header: 'مووچەی بنەڕەتی', width: '12%', align: 'center' },
      { key: 'bonuses', header: 'پاداشت', width: '10%', align: 'center' },
      { key: 'overtime', header: 'کاتی زیادە', width: '11%', align: 'center' },
      { key: 'withdrawals', header: 'پێشینە و لێبڕین', width: '11%', align: 'center' },
      { key: 'net', header: 'صافی مووچە', width: '11%', align: 'center' },
    ];

    const data = filteredPayroll.map((item, idx) => ({
      index: idx + 1,
      name: item.empName,
      role: item.role,
      base: item.baseSalary,
      bonuses: item.bonusesTotal,
      overtime: item.overtimeTotal,
      withdrawals: item.withdrawalsTotal,
      net: item.netPay,
    }));

    exportToCSV(cols, data, `Ashley_Payroll_${selectedMonth}`);

    if (onLogAudit) {
      onLogAudit('create', 'payroll', `هەناردەکردنی ئێکسیلی مووچەی مانگی (${selectedMonth})`);
    }
  };

  return (
    <div className="space-y-4 font-sans" dir="rtl">
      
      {/* 🌟 KPI BADGES: 5 CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Base Salary */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">مووچەی بنەڕەتی</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
            {totals.baseSalary > 0 ? totals.baseSalary.toLocaleString() : '۰'} IQD
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">مووچەی چەسپاو</span>
        </div>

        {/* Card 2: Bonuses */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1">
            <span className="text-[11px] font-bold">کۆی پاداشت (+)</span>
            <Gift className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-300">
            +{totals.bonuses.toLocaleString()} IQD
          </span>
          <span className="block text-[10px] text-emerald-600/70 mt-0.5">بەخشش و هاندان</span>
        </div>

        {/* Card 3: Overtime */}
        <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 mb-1">
            <span className="text-[11px] font-bold">کاتی زیادە (+)</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <span className="text-base font-bold font-mono text-amber-700 dark:text-amber-300">
            +{totals.overtime.toLocaleString()} IQD
          </span>
          <span className="block text-[10px] text-amber-600/70 mt-0.5">شایستەی ئیزافی</span>
        </div>

        {/* Card 4: Deductions / Withdrawals */}
        <div className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-300 mb-1">
            <span className="text-[11px] font-bold">کۆی پێشینە (-)</span>
            <Banknote className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-base font-bold font-mono text-rose-700 dark:text-rose-300">
            -{totals.withdrawals.toLocaleString()} IQD
          </span>
          <span className="block text-[10px] text-rose-600/70 mt-0.5">کشانەوە لە مووچە</span>
        </div>

        {/* Card 5: Net Payable */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-900 to-purple-900 text-white shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-indigo-200 mb-1">
            <span className="text-[11px] font-bold">صافی مووچە (Net)</span>
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          </div>
          <span className="text-lg font-bold font-mono text-white">
            {totals.net.toLocaleString()} IQD
          </span>
          <span className="block text-[10px] text-indigo-200 mt-0.5">کۆی پارەی دابەشکراو</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#1c1c1e] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3 flex-1 min-w-[220px]">
            <div className="relative w-full max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="گەڕان بەپێی ناوی کارمەند یان بەش..."
                className="w-full pr-8 pl-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
              />
            </div>
            <span className="text-xs text-slate-500 font-bold shrink-0">
              ({filteredPayroll.length} کارمەند)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPayroll}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ چاپی پسوولەی مووچە (PDF)</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>📥 ئێکسیل</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        {filteredPayroll.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            هیچ کارمەندێک نەدۆزرایەوە بۆ مانگی ({selectedMonth}).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold">
                  <th className={`${cellPad} text-center w-10`}>#</th>
                  <th className={cellPad}>ناوی کارمەند</th>
                  <th className={`${cellPad} text-center`}>پلە / بەش</th>
                  <th className={`${cellPad} text-center`}>مووچەی بنەڕەتی</th>
                  <th className={`${cellPad} text-center`}>پاداشت (+)</th>
                  <th className={`${cellPad} text-center`}>کاتی زیادە (+)</th>
                  <th className={`${cellPad} text-center`}>پێشینە (-)</th>
                  <th className={`${cellPad} text-center`}>صافی مووچە (Net Pay)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredPayroll.map((item, idx) => (
                  <tr key={item.empId} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                    <td className={`${cellPad} text-center font-mono text-slate-400 font-bold`}>
                      {idx + 1}
                    </td>

                    <td className={`${cellPad} font-bold text-slate-900 dark:text-white`}>
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                          {item.empName.charAt(0)}
                        </span>
                        <div>
                          <span className="block">{item.empName}</span>
                          {item.personalExpensesTotal > 0 && (
                            <span className="text-[10px] text-blue-500 font-normal">
                              مەسروفاتی ئاشڵی: {item.personalExpensesTotal.toLocaleString()} IQD
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className={`${cellPad} text-center text-slate-500`}>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-[10px] font-bold">
                        {item.role}
                      </span>
                    </td>

                    <td className={`${cellPad} text-center font-mono text-slate-600 dark:text-slate-400`}>
                      {item.baseSalary > 0 ? `${item.baseSalary.toLocaleString()} IQD` : '—'}
                    </td>

                    <td className={`${cellPad} text-center font-mono font-bold text-emerald-600 dark:text-emerald-400`}>
                      {item.bonusesTotal > 0 ? (
                        <div>
                          <span>+{item.bonusesTotal.toLocaleString()} IQD</span>
                          <span className="block text-[9px] font-normal text-slate-400">({item.bonusCount} پاداشت)</span>
                        </div>
                      ) : '—'}
                    </td>

                    <td className={`${cellPad} text-center font-mono font-bold text-amber-600 dark:text-amber-400`}>
                      {item.overtimeTotal > 0 ? (
                        <div>
                          <span>+{item.overtimeTotal.toLocaleString()} IQD</span>
                          <span className="block text-[9px] font-normal text-slate-400">({item.overtimeHours} کاتژمێر)</span>
                        </div>
                      ) : '—'}
                    </td>

                    <td className={`${cellPad} text-center font-mono font-bold text-rose-600 dark:text-rose-400`}>
                      {item.withdrawalsTotal > 0 ? (
                        <div>
                          <span>-{item.withdrawalsTotal.toLocaleString()} IQD</span>
                          <span className="block text-[9px] font-normal text-slate-400">({item.withdrawalCount} جار)</span>
                        </div>
                      ) : '—'}
                    </td>

                    <td className={`${cellPad} text-center font-mono font-bold text-slate-900 dark:text-white`}>
                      <span className="px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs inline-block">
                        {item.netPay.toLocaleString()} IQD
                      </span>
                    </td>
                  </tr>
                ))}

                {/* Grand Total Row */}
                <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-700">
                  <td colSpan={3} className={`${cellPad} text-right`}>
                    کۆی گشتی دارایی هەموو کارمەندان بۆ مانگی ({selectedMonth}):
                  </td>
                  <td className={`${cellPad} text-center font-mono text-slate-300`}>
                    {totals.baseSalary > 0 ? `${totals.baseSalary.toLocaleString()} IQD` : '—'}
                  </td>
                  <td className={`${cellPad} text-center font-mono text-emerald-400`}>
                    +{totals.bonuses.toLocaleString()} IQD
                  </td>
                  <td className={`${cellPad} text-center font-mono text-amber-400`}>
                    +{totals.overtime.toLocaleString()} IQD
                  </td>
                  <td className={`${cellPad} text-center font-mono text-rose-400`}>
                    -{totals.withdrawals.toLocaleString()} IQD
                  </td>
                  <td className={`${cellPad} text-center font-mono text-amber-300 text-sm`}>
                    {totals.net.toLocaleString()} IQD
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
