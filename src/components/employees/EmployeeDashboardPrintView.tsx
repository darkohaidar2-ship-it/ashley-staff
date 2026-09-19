'use client';
import React from 'react';
import { Employee, AppSettings } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { useTranslation } from '@/hooks/use-translation';
import { ReportWrapper } from '@/components/reports/ReportWrapper';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from 'lucide-react';

export const EmployeeDashboardPrintView = ({ employees, settings }: { employees: Employee[], settings: AppSettings }) => {
    const { t, language } = useTranslation();
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    return (
        <ReportWrapper 
            title="تۆماری فەرمی کارمەندان و ستاف (Employees Master Directory)"
            period={`بەروار: ${todayStr}`}
            showSignatures={true}
        >
            {/* Summary Bar */}
            <div className="mb-3 p-2 bg-slate-50 border border-slate-300 rounded-md flex justify-between items-center text-xs font-bold text-slate-700">
                <span>📋 <strong>تێبینی:</strong> لیستی فەرمی کارمەندانی کۆمپانیای مۆبیلیاتی ئاشڵی و دیوان گروپ • کۆی گشتی ستاف: <strong>{employees.length}</strong> کارمەند</span>
                <span className="font-mono text-[11px] text-slate-500">Document: ASH-EMP-{todayStr}</span>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-right text-xs">
                <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-black">
                        <th className="p-2 border-l border-slate-300 text-center w-10">#</th>
                        <th className="p-2 border-l border-slate-300 w-14 text-center">وێنە</th>
                        <th className="p-2 border-l border-slate-300">ناوی تەواوی کارمەند</th>
                        <th className="p-2 border-l border-slate-300 text-center w-28">کۆدی فەرمی (ID)</th>
                        <th className="p-2 border-l border-slate-300">دەسەڵات / ڕۆڵ</th>
                        <th className="p-2 border-l border-slate-300 font-mono text-center w-32">ژمارەی مۆبایل</th>
                        <th className="p-2 text-center w-32">دەستپێکی دەوام</th>
                    </tr>
                </thead>
                <tbody>
                    {employees.map((employee, idx) => {
                        const displayName = employee.fullName3Part || (language === 'ku' && employee.kurdishName ? employee.kurdishName : employee.name);
                        const safeEmploymentStartDate = employee.employmentStartDate && !isNaN(parseISO(employee.employmentStartDate).getTime()) ? parseISO(employee.employmentStartDate) : null;
                        
                        return (
                            <tr key={employee.id} className={`border-b border-slate-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} break-inside-avoid`}>
                                <td className="p-2 border-l border-slate-300 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                                <td className="p-1 border-l border-slate-300 text-center">
                                    <Avatar className="w-8 h-8 rounded-md mx-auto border border-slate-200">
                                        <AvatarImage src={employee.photoUrl || undefined} />
                                        <AvatarFallback><User className="w-4 h-4 text-slate-400" /></AvatarFallback>
                                    </Avatar>
                                </td>
                                <td className="p-2 border-l border-slate-300 font-bold text-slate-900">
                                    {displayName}
                                </td>
                                <td className="p-2 border-l border-slate-300 text-center font-mono font-bold text-blue-700">{employee.id || employee.employeeId || 'N/A'}</td>
                                <td className="p-2 border-l border-slate-300 font-medium text-slate-700">{employee.role || 'Staff'}</td>
                                <td className="p-2 border-l border-slate-300 text-center font-mono font-semibold text-slate-600" dir="ltr">{employee.phone || 'N/A'}</td>
                                <td className="p-2 text-center font-mono text-slate-600">{safeEmploymentStartDate ? format(safeEmploymentStartDate, 'yyyy-MM-dd') : 'N/A'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </ReportWrapper>
    );
};
