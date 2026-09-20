'use client';
import React from 'react';
import { Employee, AppSettings } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useTranslation } from '@/hooks/use-translation';
import { ReportWrapper } from '@/components/reports/ReportWrapper';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, CheckCircle2, XCircle, Smartphone, Sparkles, Calendar } from 'lucide-react';

export interface EmployeeDashboardPrintViewProps {
  employees: Employee[];
  settings?: AppSettings;
  registeredFaces?: Set<string>;
  complianceMap?: Record<string, { presentDays: number; rate: number }>;
}

export const EmployeeDashboardPrintView = ({ 
  employees, 
  settings,
  registeredFaces,
  complianceMap = {}
}: EmployeeDashboardPrintViewProps) => {
    const { language } = useTranslation();
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Summary calculations for print view
    const totalStaff = employees.length;
    const activeStaff = employees.filter(e => e.isActive !== false && e.status !== 'resigned').length;
    const boundDevices = employees.filter(e => (e as any).deviceBound || (e as any).boundDeviceModel).length;
    const registeredFaceCount = employees.filter(e => {
        const empId = (e.id || '').toLowerCase();
        const numId = (e.employeeId || '').toLowerCase();
        return (registeredFaces && (registeredFaces.has(empId) || registeredFaces.has(numId))) || (e as any).faceRegistered;
    }).length;

    return (
        <ReportWrapper 
            title="تۆماری فەرمی کارمەندان و ستاف (Employees Master Directory)"
            period={`بەروار: ${todayStr}`}
            showSignatures={true}
        >
            {/* 📊 Summary Metrics Strip */}
            <div className="mb-3 grid grid-cols-5 gap-2 text-center text-xs">
                <div className="p-1.5 bg-slate-50 border border-slate-300 rounded">
                    <span className="text-[10px] text-slate-500 block font-bold">کۆی گشتی ستاف</span>
                    <span className="font-mono font-black text-slate-900 text-sm">{totalStaff} کەس</span>
                </div>
                <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded">
                    <span className="text-[10px] text-emerald-700 block font-bold">دەوامی چالاک</span>
                    <span className="font-mono font-black text-emerald-800 text-sm">{activeStaff} کارمەند</span>
                </div>
                <div className="p-1.5 bg-indigo-50 border border-indigo-200 rounded">
                    <span className="text-[10px] text-indigo-700 block font-bold">مۆبایلی بەستراو</span>
                    <span className="font-mono font-black text-indigo-800 text-sm">{boundDevices} ئامێر</span>
                </div>
                <div className="p-1.5 bg-purple-50 border border-purple-200 rounded">
                    <span className="text-[10px] text-purple-700 block font-bold">ناسینی ڕوخسار (AI)</span>
                    <span className="font-mono font-black text-purple-800 text-sm">{registeredFaceCount} ناسراو</span>
                </div>
                <div className="p-1.5 bg-slate-50 border border-slate-300 rounded font-mono text-[10px] flex flex-col justify-center text-slate-500">
                    <span>کۆدی بەڵگەنامە</span>
                    <span className="font-bold text-slate-800">ASH-EMP-{todayStr}</span>
                </div>
            </div>

            {/* 📋 Comprehensive Table */}
            <table className="w-full border-collapse border border-slate-300 text-right text-[11px] leading-tight">
                <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-black">
                        <th className="p-1.5 border-l border-slate-300 text-center w-8">#</th>
                        <th className="p-1.5 border-l border-slate-300 w-10 text-center">وێنە</th>
                        <th className="p-1.5 border-l border-slate-300">ناوی تەواوی سێ قۆڵی</th>
                        <th className="p-1.5 border-l border-slate-300 text-center w-16">کۆدی ID</th>
                        <th className="p-1.5 border-l border-slate-300 text-center w-16">کۆدی PIN</th>
                        <th className="p-1.5 border-l border-slate-300 w-28">دەسەڵات / ڕۆڵ</th>
                        <th className="p-1.5 border-l border-slate-300 font-mono text-center w-24">ژمارەی مۆبایل</th>
                        <th className="p-1.5 border-l border-slate-300 text-center w-20">ئامێری مۆبایل</th>
                        <th className="p-1.5 border-l border-slate-300 text-center w-20">ناسینی ڕوخسار</th>
                        <th className="p-1.5 border-l border-slate-300 text-center w-16">پابەندبوون</th>
                        <th className="p-1.5 border-l border-slate-300 text-center w-20">دەستپێکی دەوام</th>
                        <th className="p-1.5 text-center w-14">دۆخ</th>
                    </tr>
                </thead>
                <tbody>
                    {employees.map((employee, idx) => {
                        const displayName = (employee as any).fullName3Part || (language === 'ku' && employee.kurdishName ? employee.kurdishName : employee.name);
                        const safeEmploymentStartDate = employee.employmentStartDate && !isNaN(parseISO(employee.employmentStartDate).getTime()) ? parseISO(employee.employmentStartDate) : null;
                        const empId = (employee.id || '').toLowerCase();
                        const numId = (employee.employeeId || '').toLowerCase();
                        const hasFace = (registeredFaces && (registeredFaces.has(empId) || registeredFaces.has(numId))) || (employee as any).faceRegistered;
                        const hasDevice = (employee as any).deviceBound || (employee as any).boundDeviceModel;
                        const compliance = complianceMap[employee.id]?.rate ?? (employee.status === 'resigned' ? 0 : 95);
                        const isResigned = employee.status === 'resigned';
                        const pinCode = (employee as any).pin || (employee as any).password || '—';

                        return (
                            <tr key={employee.id} className={`border-b border-slate-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} break-inside-avoid`}>
                                <td className="p-1 border-l border-slate-300 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                                <td className="p-1 border-l border-slate-300 text-center">
                                    <Avatar className="w-7 h-7 rounded-md mx-auto border border-slate-200">
                                        <AvatarImage src={employee.photoUrl || undefined} />
                                        <AvatarFallback><User className="w-3.5 h-3.5 text-slate-400" /></AvatarFallback>
                                    </Avatar>
                                </td>
                                <td className="p-1.5 border-l border-slate-300 font-bold text-slate-900">
                                    {displayName}
                                </td>
                                <td className="p-1 border-l border-slate-300 text-center font-mono font-bold text-blue-700">{employee.employeeId || employee.id.replace('emp-', '')}</td>
                                <td className="p-1 border-l border-slate-300 text-center font-mono font-semibold text-slate-700 bg-slate-50/80">{pinCode}</td>
                                <td className="p-1.5 border-l border-slate-300 font-medium text-slate-700">{employee.role || 'Staff'}</td>
                                <td className="p-1 border-l border-slate-300 text-center font-mono font-semibold text-slate-600 text-[10px]" dir="ltr">{employee.phone || '—'}</td>
                                
                                {/* Device Binding */}
                                <td className="p-1 border-l border-slate-300 text-center">
                                    {hasDevice ? (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                            📱 بەستراوەتەوە
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-slate-400 font-medium">نەبەستراوە</span>
                                    )}
                                </td>

                                {/* Face ID */}
                                <td className="p-1 border-l border-slate-300 text-center">
                                    {hasFace ? (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                            🟢 ناسراوە
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-amber-600 font-medium">⚠️ تۆمارنەکراو</span>
                                    )}
                                </td>

                                {/* Attendance Compliance Rate */}
                                <td className="p-1 border-l border-slate-300 text-center font-mono font-bold">
                                    {isResigned ? (
                                        <span className="text-slate-400 text-[10px]">0%</span>
                                    ) : (
                                        <span className={`text-[10px] ${compliance >= 85 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                            {compliance}%
                                        </span>
                                    )}
                                </td>

                                {/* Start Date */}
                                <td className="p-1 border-l border-slate-300 text-center font-mono text-[10px] text-slate-600">
                                    {safeEmploymentStartDate ? format(safeEmploymentStartDate, 'yyyy-MM-dd') : ((employee as any).startDate || '—')}
                                </td>

                                {/* Status */}
                                <td className="p-1 text-center">
                                    {isResigned ? (
                                        <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">دەستلەکارکێشاو</span>
                                    ) : (
                                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">چالاک</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </ReportWrapper>
    );
};
